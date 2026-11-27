import { all, now, one, parseJson, run, tx } from "./db";
import { ApiError, today, weekday } from "./api";
import type { User } from "./auth";
import { addDays, isDate, tasksForRange, translateTask } from "./household";
import { isLang, pick, type Lang, type Texts } from "../languages";
import type { Task, Template, TemplateApplication, TemplatePreview, TemplateTask, TemplatesView } from "../types";
import { SAMPLES } from "../templates/samples";

// 3.0 task templates. Samples live in code (English and Chinese); a household's own templates and every time one is
// put on the calendar live in SQLite. Applied tasks are ordinary tasks (same table, same translation), tagged with
// the application that added them so they can come off together. Editing or deleting a template never touches them.

type R = Record<string, unknown>;
const MAX_TASKS = 40;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Check and tidy tasks sent by the editor. Throws a coded 400 the screen explains. */
export function cleanTasks(raw: unknown): TemplateTask[] {
  if (!Array.isArray(raw)) throw new ApiError(400, "no_tasks");
  if (raw.length > MAX_TASKS) throw new ApiError(400, "too_many_tasks");
  return raw.map((x: R) => {
    const title = typeof x?.title === "string" ? x.title.trim().slice(0, 200) : "";
    if (!title) throw new ApiError(400, "title_required");
    const repeat = x.repeat === "weekly" || x.repeat === "monthly" || x.repeat === "once" ? x.repeat : "daily";
    const weekdays = repeat === "weekly" ? [...new Set((Array.isArray(x.weekdays) ? x.weekdays : []).filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort() as number[] : [];
    if (repeat === "weekly" && weekdays.length === 0) throw new ApiError(400, "weekdays_required");
    const day = repeat === "once" ? Number(x.day) : null;
    if (repeat === "once" && !(Number.isInteger(day) && day! >= 1 && day! <= 7)) throw new ApiError(400, "bad_day");
    return {
      title,
      note: typeof x.note === "string" ? x.note.trim().slice(0, 500) : "",
      time: typeof x.time === "string" && TIME_RE.test(x.time) ? x.time : null,
      repeat,
      weekdays,
      day,
    };
  });
}

function sampleLang(lang: Lang): "en" | "zh" {
  return lang === "zh" ? "zh" : "en";
}

function applications(source: string): TemplateApplication[] {
  return all<R>(
    `SELECT a.*, u.name AS by_name FROM template_applications a LEFT JOIN users u ON u.id = a.created_by WHERE a.source = ? AND a.removed_at IS NULL ORDER BY a.created_at DESC`,
    source,
  )
    .map((a) => ({ id: a.id as number, start_date: a.start_date as string, count: removable(a.id as number).length, by: (a.by_name as string) ?? "" }))
    .filter((a) => a.count > 0);
}

function sampleTemplate(key: string, lang: Lang): Template | null {
  const s = SAMPLES.find((x) => x.key === key);
  if (!s) return null;
  const l = sampleLang(lang);
  return {
    ref: `sample:${s.key}`,
    kind: "sample",
    name: s[l].name,
    description: s[l].description,
    lang: l,
    tasks: s.tasks.map((t) => ({ title: t[l].title, note: t[l].note, time: t.time, repeat: t.repeat, weekdays: t.weekdays, day: t.day })),
    saved_by: null,
    updated_at: null,
    on_calendar: applications(`sample:${s.key}`),
  };
}

function toMine(r: R): Template {
  return {
    ref: `mine:${r.id}`,
    kind: "mine",
    name: r.name as string,
    description: "",
    lang: isLang(r.lang) ? r.lang : "en",
    tasks: parseJson<TemplateTask[]>(r.tasks, []),
    saved_by: (r.by_name as string) ?? null,
    updated_at: r.updated_at as number,
    on_calendar: applications(`mine:${r.id}`),
  };
}

const MINE_SELECT = "SELECT t.*, u.name AS by_name FROM templates t LEFT JOIN users u ON u.id = t.created_by";

export function listTemplates(lang: Lang): TemplatesView {
  return {
    today: today(),
    samples: SAMPLES.map((s) => sampleTemplate(s.key, lang)!),
    mine: all<R>(`${MINE_SELECT} ORDER BY t.updated_at DESC`).map(toMine),
  };
}

export function getTemplate(ref: string, lang: Lang): Template {
  const [kind, id] = ref.split(":");
  const t = kind === "sample" ? sampleTemplate(id, lang) : kind === "mine" ? mineById(Number(id)) : null;
  if (!t) throw new ApiError(404, "not_found");
  return t;
}

function mineById(id: number): Template | null {
  if (!Number.isInteger(id)) return null;
  const r = one<R>(`${MINE_SELECT} WHERE t.id = ?`, id);
  return r ? toMine(r) : null;
}

function cleanName(v: unknown): string {
  const name = typeof v === "string" ? v.trim().slice(0, 80) : "";
  if (!name) throw new ApiError(400, "name_required");
  return name;
}

export function saveNew(user: User, input: { name: unknown; lang: unknown; tasks: unknown }): Template {
  const name = cleanName(input.name);
  const tasks = cleanTasks(input.tasks);
  if (tasks.length === 0) throw new ApiError(400, "no_tasks");
  const lang = isLang(input.lang) ? input.lang : (user.lang ?? "en");
  const { id } = run("INSERT INTO templates (name, lang, tasks, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)", name, lang, JSON.stringify(tasks), user.id, now(), now());
  return mineById(id)!;
}

export function saveMine(id: number, input: { name?: unknown; tasks?: unknown }): Template {
  const r = one<R>("SELECT * FROM templates WHERE id = ?", id);
  if (!r) throw new ApiError(404, "not_found");
  const name = input.name === undefined ? (r.name as string) : cleanName(input.name);
  const tasks = input.tasks === undefined ? parseJson<TemplateTask[]>(r.tasks, []) : cleanTasks(input.tasks);
  if (tasks.length === 0) throw new ApiError(400, "no_tasks");
  run("UPDATE templates SET name = ?, tasks = ?, updated_at = ? WHERE id = ?", name, JSON.stringify(tasks), now(), id);
  return mineById(id)!;
}

/** Deleting a template leaves the tasks it put on the calendar as they are. */
export function deleteMine(id: number) {
  if (!run("DELETE FROM templates WHERE id = ?", id).changes) throw new ApiError(404, "not_found");
}

// ---------------------------------------------------------------- preview and apply

/** Does template task `t`, applied from `start`, fall on `date`? Repeats never before the start date. */
function lands(t: TemplateTask, start: string, date: string): boolean {
  if (date < start) return false;
  if (t.repeat === "once") return addDays(start, (t.day ?? 1) - 1) === date;
  if (t.repeat === "daily") return true;
  if (t.repeat === "weekly") return t.weekdays.includes(weekday(date));
  const want = Number(start.slice(8, 10));
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Number(date.slice(8, 10)) === Math.min(want, last);
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Is a task with this title (in any of its languages) and time already on the calendar that day? */
function sameTask(existing: Task, title: string, time: string | null): boolean {
  if ((existing.time ?? null) !== (time ?? null)) return false;
  const want = norm(title);
  const names = [existing.title, ...Object.values((existing.title_tr ?? {}) as Texts)].filter((x): x is string => typeof x === "string");
  return names.some((n) => norm(n) === want);
}

function checkStart(start: unknown): string {
  if (!isDate(start)) throw new ApiError(400, "bad_date");
  if (start < today()) throw new ApiError(400, "past_date");
  return start;
}

/**
 * The first week from `start`: which tasks land on which day, and which of those days already have it on the calendar
 * (same title and time that day). Only those days are skipped, so the calendar ends up showing what the preview showed.
 */
export function preview(tasks: TemplateTask[], start: string): TemplatePreview {
  return plan(tasks, start).preview;
}

/**
 * The preview plus which tasks get added. A repeating task already on every first-week day it lands is not added,
 * unless one of those matches stops (a removed template's routine ends on its removal day): then the task is added
 * again and only those days are skipped, so it carries on after the first week.
 */
function plan(tasks: TemplateTask[], start: string): { preview: TemplatePreview; adds: Set<number> } {
  const end = addDays(start, 6);
  const existing = tasksForRange(start, end);
  const ending = new Set(all<{ id: number }>("SELECT id FROM tasks WHERE removed_at IS NULL AND kind = 'routine' AND end_date IS NOT NULL").map((r) => r.id));
  const days: TemplatePreview["days"] = [];
  const adds = new Set<number>();
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const list = tasks
      .map((t, index) => ({ t, index }))
      .filter(({ t }) => lands(t, start, d))
      .map(({ t, index }) => {
        const match = (existing.get(d) ?? []).find((e) => sameTask(e, t.title, t.time));
        const already = !!match;
        if (!match || (t.repeat !== "once" && (match.kind === "once" || ending.has(match.id)))) adds.add(index);
        return { index, title: t.title, time: t.time, already };
      })
      .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
    days.push({ date: d, tasks: list });
  }
  // a task that lands nowhere in the first week (a monthly one, say) is still added
  tasks.forEach((t, i) => { if (!days.some((d) => d.tasks.some((x) => x.index === i))) adds.add(i); });
  return { preview: { start, days, adding: adds.size }, adds };
}

export function previewFor(input: { tasks: unknown; start: unknown }): TemplatePreview {
  return preview(cleanTasks(input.tasks), checkStart(input.start));
}

/** Put the (edited) tasks on the calendar from `start`, all or nothing. Translation follows, as for hand-typed tasks. */
export function apply(user: User, input: { source: unknown; name: unknown; lang: unknown; tasks: unknown; start: unknown }) {
  const start = checkStart(input.start);
  const tasks = cleanTasks(input.tasks);
  if (tasks.length === 0) throw new ApiError(400, "no_tasks");
  const source = typeof input.source === "string" && /^(sample:[a-z]+|mine:\d+)$/.test(input.source) ? input.source : "edited";
  const name = cleanName(input.name);
  const lang: Lang = isLang(input.lang) ? input.lang : (user.lang ?? "en");
  const { preview: p, adds } = plan(tasks, start);
  // per task: the first-week days that already have it; a task already on every day it lands is not added
  const alreadyOn = new Map<number, string[]>();
  for (const d of p.days) for (const x of d.tasks) if (x.already) alreadyOn.set(x.index, [...(alreadyOn.get(x.index) ?? []), d.date]);
  const skip = new Set(tasks.map((_, i) => i).filter((i) => !adds.has(i)));
  const ids = tx(() => {
    const t0 = now();
    const app = run("INSERT INTO template_applications (source, name, start_date, created_by, created_at) VALUES (?,?,?,?,?)", source, name, start, user.id, t0);
    const out: number[] = [];
    tasks.forEach((t, i) => {
      if (skip.has(i)) return;
      const once = t.repeat === "once";
      const { id } = run(
        "INSERT INTO tasks (title, note, lang, time, photo_id, kind, weekdays, date, repeat, start_date, created_by, created_at, updated_at, application_id, skip_dates) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        t.title,
        t.note,
        lang,
        t.time,
        null,
        once ? "once" : "routine",
        JSON.stringify(t.repeat === "weekly" ? t.weekdays : []),
        once ? addDays(start, (t.day ?? 1) - 1) : null,
        once ? null : t.repeat,
        once ? null : start,
        user.id,
        t0,
        t0,
        app.id,
        once || !alreadyOn.has(i) ? null : JSON.stringify(alreadyOn.get(i)),
      );
      out.push(id);
    });
    return { app: app.id, ids: out };
  });
  // answer now and translate in the background, a few at a time; any that fail are picked up later by
  // fillMissingTranslations (Today runs it), so the tasks still reach her in Burmese
  const queue = [...ids.ids];
  void Promise.all(Array.from({ length: 4 }, async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) await translateTask(id);
  })).catch(() => {});
  return { added: ids.ids.length, application: ids.app, start, name };
}

/** Tasks of this application that still show today or later: the ones Remove would take off. */
function removable(appId: number): R[] {
  const d = today();
  return all<R>("SELECT * FROM tasks WHERE application_id = ? AND removed_at IS NULL", appId).filter((r) =>
    r.kind === "once" ? (r.date as string) >= d && !(r.date === d && isDone(r.id as number, d)) : !r.end_date || (r.end_date as string) >= d && !(r.end_date === d && isDone(r.id as number, d)),
  );
}

function isDone(taskId: number, date: string) {
  return !!one("SELECT 1 FROM task_done WHERE task_id = ? AND date = ?", taskId, date);
}

/**
 * Take one application's tasks off the calendar from today on. Days before today stay as they were (with their ticks),
 * and so does today when she already ticked it. Hand-typed tasks and other applications are not touched.
 */
export function removeApplication(appId: number): { removed: number } {
  const app = one<R>("SELECT * FROM template_applications WHERE id = ? AND removed_at IS NULL", appId);
  if (!app) throw new ApiError(404, "not_found");
  const d = today();
  return tx(() => {
    const rows = removable(appId);
    for (const r of rows) {
      if (r.kind === "once") {
        run("UPDATE tasks SET removed_at = ? WHERE id = ?", now(), r.id);
        continue;
      }
      const end = isDone(r.id as number, d) ? d : addDays(d, -1);
      if (end < (r.start_date as string)) run("UPDATE tasks SET removed_at = ? WHERE id = ?", now(), r.id);
      else run("UPDATE tasks SET end_date = ?, updated_at = ? WHERE id = ?", end, now(), r.id);
    }
    run("UPDATE template_applications SET removed_at = ? WHERE id = ?", now(), appId);
    return { removed: rows.length };
  });
}

// ---------------------------------------------------------------- a calendar week as a template

/** The tasks of the week starting `from` (not events or days off), each keeping its time and how it repeats. */
export function saveWeek(user: User, input: { name: unknown; from: unknown; lang: unknown }): Template {
  if (!isDate(input.from)) throw new ApiError(400, "bad_date");
  const from = input.from;
  const lang: Lang = isLang(input.lang) ? input.lang : (user.lang ?? "en");
  const name = cleanName(input.name);
  const seen = new Set<number>();
  const tasks: TemplateTask[] = [];
  const week = tasksForRange(from, addDays(from, 6));
  for (let i = 0; i < 7; i++) {
    for (const t of week.get(addDays(from, i)) ?? []) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      const base = { title: pick(t.title, t.lang, t.title_tr, lang), note: t.note ? pick(t.note, t.lang, t.note_tr, lang) : "", time: t.time };
      if (t.repeat === "none") tasks.push({ ...base, repeat: "once", weekdays: [], day: i + 1 });
      else tasks.push({ ...base, repeat: t.repeat, weekdays: t.repeat === "weekly" ? t.weekdays : [], day: null });
    }
  }
  if (tasks.length === 0) throw new ApiError(400, "empty_week");
  tasks.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  return saveNew(user, { name, lang, tasks: tasks.slice(0, MAX_TASKS) });
}

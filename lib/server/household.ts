import { all, now, one, parseJson, run, tx } from "./db";
import { ApiError, today, weekday } from "./api";
import { AiUnavailable, aiConfigured, draftTalk, translateAll, translateFields } from "./ai";
import { helperLang, type User } from "./auth";
import { isLang, type Lang, type Texts } from "../languages";
import type { CalDay, CalItem, DayView, Draft, Entry, Line, Note, Question, SearchHit, Section, Step, TalkDetail, TalkSummary, Task, TodayView } from "../types";
import { SECTIONS } from "../types";

type R = Record<string, unknown>;
const asLang = (v: unknown): Lang => (isLang(v) ? v : "en");

// ---------------------------------------------------------------- talks

function toLine(r: R): Line {
  return {
    id: r.id as number,
    talk_id: r.talk_id as number,
    speaker: r.speaker as Line["speaker"],
    kind: r.kind as Line["kind"],
    text: r.text as string,
    lang: asLang(r.lang),
    tr: parseJson<Texts | null>(r.tr, null),
    photo: (r.photo_id as string) ?? null,
    created_at: r.created_at as number,
    edited_at: (r.edited_at as number) ?? null,
  };
}

function toTalk(r: R): TalkSummary {
  const first = one<R>("SELECT * FROM talk_lines WHERE talk_id = ? AND kind = 'text' ORDER BY id LIMIT 1", r.id);
  return {
    id: r.id as number,
    lang: asLang(r.lang),
    title: (r.title as string) ?? null,
    title_tr: parseJson<Texts | null>(r.title_tr, null),
    created_at: r.created_at as number,
    updated_at: r.updated_at as number,
    lines: (r.line_count as number) ?? 0,
    waiting: (r.waiting as number) ?? 0,
    drafting: !!r.drafting,
    first_line: first ? toLine(first) : null,
  };
}

const TALK_SELECT = `SELECT t.*, (SELECT COUNT(*) FROM talk_lines l WHERE l.talk_id = t.id) AS line_count,
  (SELECT COUNT(*) FROM drafts d WHERE d.talk_id = t.id AND d.status = 'waiting') AS waiting FROM talks t`;

/**
 * 5.3: a helper sees only talks held since her account joined (a talk started before that is not hers: History, day
 * pages, search, direct links, its lines and counts). Employers see every talk. 0 = no limit.
 */
export function talksSince(viewer: User | null | undefined): number {
  return viewer?.role === "helper" ? viewer.created_at : 0;
}

export function talkVisible(viewer: User | null | undefined, talkCreatedAt: number): boolean {
  return talkCreatedAt >= talksSince(viewer);
}

export function listTalks(viewer: User): TalkSummary[] {
  kickStaleDrafting();
  return all<R>(`${TALK_SELECT} WHERE line_count > 0 AND t.created_at >= ? ORDER BY t.updated_at DESC LIMIT 200`, talksSince(viewer)).map(toTalk);
}

export function latestTalk(viewer: User): TalkDetail | null {
  const r = one<R>(`${TALK_SELECT} WHERE t.created_at >= ? ORDER BY t.updated_at DESC LIMIT 1`, talksSince(viewer));
  return r ? talkDetail(r.id as number, viewer) : null;
}

/** A talk with its lines. With a viewer, a talk she may not see answers 404 like one that does not exist. */
export function talkDetail(id: number, viewer?: User): TalkDetail {
  const r = one<R>(`${TALK_SELECT} WHERE t.id = ?`, id);
  if (!r || (viewer && !talkVisible(viewer, r.created_at as number))) throw new ApiError(404, "not_found");
  const lines = all<R>("SELECT * FROM talk_lines WHERE talk_id = ? ORDER BY id", id).map(toLine);
  const drafts = all<R>("SELECT * FROM drafts WHERE talk_id = ? ORDER BY id", id).map(toDraft);
  return { ...toTalk(r), lines, drafts, draft_error: (r.draft_error as string) ?? null } as unknown as TalkDetail;
}

/** What a helper may see of a talk: its lines, never drafts or how many wait (nothing reaches her until approved). */
export function forHelper<T extends TalkSummary | TalkDetail>(t: T): T {
  const out = { ...t, waiting: 0, drafting: false };
  if ("drafts" in out) (out as TalkDetail).drafts = [];
  if ("draft_error" in out) (out as TalkDetail).draft_error = null;
  return out;
}

/**
 * One talk per day on the phone's own clock (5.1). The phone sends its local midnight-to-midnight as
 * [start, end); the day's talk is the newest talk with a line in that window (or made in it and still empty).
 */
function talkIdForDay(start: number, end: number): number | null {
  const r = one<{ id: number }>(
    `SELECT t.id FROM talks t WHERE EXISTS (SELECT 1 FROM talk_lines l WHERE l.talk_id = t.id AND l.created_at >= ? AND l.created_at < ?)
     OR (t.created_at >= ? AND t.created_at < ? AND NOT EXISTS (SELECT 1 FROM talk_lines l WHERE l.talk_id = t.id))
     ORDER BY t.id DESC LIMIT 1`,
    start, end, start, end,
  );
  return r?.id ?? null;
}

export function dayTalk(start: number, end: number, viewer: User): TalkDetail | null {
  const id = talkIdForDay(start, end);
  if (!id) return null;
  const t = one<{ created_at: number }>("SELECT created_at FROM talks WHERE id = ?", id);
  return t && talkVisible(viewer, t.created_at) ? talkDetail(id, viewer) : null;
}

/** The day's talk, made on the day's first line. Synchronous, so two phones adding at once share one talk. */
export function dayTalkOrNew(user: User, lang: Lang, start: number, end: number): TalkDetail {
  return talkDetail(talkIdForDay(start, end) ?? createTalk(user, lang));
}

export function createTalk(user: User, lang: Lang): number {
  return run("INSERT INTO talks (lang, created_by, created_at, updated_at) VALUES (?,?,?,?)", lang, user.id, now(), now()).id;
}

function touchTalk(talkId: number) {
  run("UPDATE talks SET updated_at = ? WHERE id = ?", now(), talkId);
}

/** Save the line first (so nothing said is lost), then translate. Returns the line, translated or not. */
export async function addLine(
  user: User,
  talkId: number,
  input: { speaker: "employer" | "helper"; text: string; lang: Lang },
): Promise<{ line: Line; failed: boolean }> {
  if (!one("SELECT id FROM talks WHERE id = ?", talkId)) throw new ApiError(404, "not_found");
  const text = input.text.trim();
  if (!text) throw new ApiError(400, "empty");
  const { id } = run(
    "INSERT INTO talk_lines (talk_id, speaker, kind, text, lang, created_by, created_at) VALUES (?,?,?,?,?,?,?)",
    talkId,
    input.speaker,
    "text",
    text,
    input.lang,
    user.id,
    now(),
  );
  touchTalk(talkId);
  const failed = !(await translateLine(id));
  return { line: lineById(id), failed };
}

export function addPhotoLine(user: User, talkId: number, photoId: string, speaker: "employer" | "helper"): Line {
  if (!one("SELECT id FROM talks WHERE id = ?", talkId)) throw new ApiError(404, "not_found");
  const t = one<{ lang: string }>("SELECT lang FROM talks WHERE id = ?", talkId)!;
  const { id } = run(
    "INSERT INTO talk_lines (talk_id, speaker, kind, text, lang, photo_id, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)",
    talkId,
    speaker,
    "photo",
    "",
    t.lang,
    photoId,
    user.id,
    now(),
  );
  touchTalk(talkId);
  return lineById(id);
}

function lineById(id: number): Line {
  const r = one<R>("SELECT * FROM talk_lines WHERE id = ?", id);
  if (!r) throw new ApiError(404, "not_found");
  return toLine(r);
}

export async function translateLine(lineId: number): Promise<boolean> {
  const l = lineById(lineId);
  if (l.kind !== "text") return true;
  try {
    const tr = await translateAll(l.text, l.lang);
    run("UPDATE talk_lines SET tr = ? WHERE id = ? AND text = ?", JSON.stringify(tr), lineId, l.text);
    return true;
  } catch (e) {
    if (e instanceof AiUnavailable) return true; // no AI set up: the line stays in the words it was said in, not an error
    console.error("translate line failed", (e as Error).message);
    return false;
  }
}

export async function retryLine(lineId: number) {
  const ok = await translateLine(lineId);
  return { line: lineById(lineId), failed: !ok };
}

export async function editLine(lineId: number, text: string) {
  const l = lineById(lineId);
  const clean = text.trim();
  if (!clean) throw new ApiError(400, "empty");
  run("UPDATE talk_lines SET text = ?, tr = NULL, edited_at = ? WHERE id = ?", clean, now(), lineId);
  touchTalk(l.talk_id);
  // a corrected talk is drafted again for anything new
  run("UPDATE talks SET drafted_at = NULL WHERE id = ?", l.talk_id);
  return retryLine(lineId);
}

/**
 * Remove one line for good (5.1). The talk is not touched, so it is not drafted again and its notes, drafts and
 * auto-added entries stay as they are; a talk left with no lines drops out of History and day pages.
 * Deleting a line that is already gone is not an error.
 */
export function deleteLine(lineId: number) {
  run("DELETE FROM talk_lines WHERE id = ?", lineId);
}

export function deleteTalk(talkId: number) {
  run("DELETE FROM talks WHERE id = ?", talkId);
}

// ---------------------------------------------------------------- drafting

const drafting = new Set<number>();

/** Draft a talk into Notebook suggestions. Runs in the background; safe to call repeatedly. */
export function startDrafting(talkId: number) {
  if (drafting.has(talkId) || !aiConfigured()) return; // without AI nothing is drafted, and that is not an error
  drafting.add(talkId);
  run("UPDATE talks SET drafting = 1, draft_error = NULL WHERE id = ?", talkId);
  draftNow(talkId)
    .catch((e) => {
      console.error("drafting failed", (e as Error).message);
      run("UPDATE talks SET draft_error = ? WHERE id = ?", "failed", talkId);
    })
    .finally(() => {
      drafting.delete(talkId);
      run("UPDATE talks SET drafting = 0 WHERE id = ?", talkId);
    });
}

/** Talks left quiet for five minutes are drafted without anyone asking. */
function kickStaleDrafting() {
  const stale = all<{ id: number }>(
    `SELECT t.id FROM talks t WHERE (t.drafted_at IS NULL OR t.drafted_at < t.updated_at) AND t.updated_at < ? AND t.drafting = 0
     AND t.draft_error IS NULL AND EXISTS (SELECT 1 FROM talk_lines l WHERE l.talk_id = t.id AND l.kind = 'text') LIMIT 3`,
    now() - 5 * 60_000,
  );
  for (const s of stale) startDrafting(s.id);
}

export async function draftNow(talkId: number) {
  const talk = one<R>("SELECT * FROM talks WHERE id = ?", talkId);
  if (!talk) return;
  const lang = asLang(talk.lang);
  const lines = all<R>("SELECT * FROM talk_lines WHERE talk_id = ? ORDER BY id", talkId).map(toLine);
  if (!lines.some((l) => l.kind === "text")) return;
  const startedAt = now();
  const photoIds: Record<string, string> = {};
  let p = 0;
  const transcript = lines
    .map((l) => {
      if (l.kind === "photo" && l.photo) {
        const key = `P${++p}`;
        photoIds[key] = l.photo;
        return `[photo ${key}]`;
      }
      const text = l.lang === lang ? l.text : (l.tr?.[lang] ?? l.text);
      return `${l.speaker === "employer" ? "E" : "H"}: ${text}`;
    })
    .join("\n");
  const notebook = all<R>("SELECT * FROM entries WHERE removed_at IS NULL ORDER BY section, pos").map((r) => {
    const e = toEntry(r, null);
    return {
      id: e.id,
      section: e.section,
      title: e.lang === lang ? e.title : (e.title_tr?.[lang] ?? e.title),
      body: e.lang === lang ? e.body : (e.body_tr?.[lang] ?? e.body),
    };
  });
  const already = all<{ title: string }>("SELECT title FROM drafts WHERE talk_id = ? AND status != 'dropped'", talkId).map((d) => d.title);
  const out = await draftTalk({ lang, transcript, notebook, already });
  const validIds = new Set(notebook.map((n) => n.id));
  // already-suggested titles in this talk are not suggested again
  const existing = new Set(all<{ title: string }>("SELECT title FROM drafts WHERE talk_id = ?", talkId).map((d) => d.title.toLowerCase()));
  // a critical point whose title is already a Notebook entry sits with that entry rather than appearing twice
  const titleToEntry = new Map(notebook.map((n) => [n.title.trim().toLowerCase(), n.id]));
  const critical: { draftId: number; match: "new" | "merge" | "replace"; target: number | null }[] = [];
  tx(() => {
    if (out.title) {
      run("UPDATE talks SET title = ?, title_tr = NULL WHERE id = ? AND (title IS NULL OR drafted_at IS NULL)", String(out.title).slice(0, 80), talkId);
    }
    for (const d of (out.drafts ?? []).slice(0, 8)) {
      if (!d?.title || existing.has(String(d.title).toLowerCase())) continue;
      const kind = ["keypoint", "instruction", "guide"].includes(d.kind) ? d.kind : "keypoint";
      const section: Section = SECTIONS.includes(d.section) ? d.section : kind === "keypoint" ? "details" : "instructions";
      const isCritical = d.critical === true;
      let target = d.target_id && validIds.has(Number(d.target_id)) ? Number(d.target_id) : null;
      let match: "new" | "merge" | "replace" = target && (d.match === "merge" || d.match === "replace") ? d.match : "new";
      if (isCritical && match === "new") {
        const same = titleToEntry.get(String(d.title).trim().toLowerCase());
        if (same) {
          if (!d.body || notebook.find((n) => n.id === same)?.body.includes(String(d.body).trim())) continue; // already there, word for word
          target = same;
          match = "merge";
          d.merged_body = `${notebook.find((n) => n.id === same)?.body ?? ""}\n${d.body}`.trim();
        }
      }
      const steps = Array.isArray(d.steps)
        ? d.steps.filter((s) => s?.text).map((s) => ({ text: String(s.text), photo: s.photo && photoIds[String(s.photo)] ? photoIds[String(s.photo)] : null }))
        : [];
      existing.add(String(d.title).toLowerCase());
      const ins = run(
        `INSERT INTO drafts (talk_id, kind, section, title, body, lang, steps, match, target_entry_id, merged_body, reason, created_at, status, auto, decided_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        talkId,
        kind,
        section,
        String(d.title).slice(0, 120),
        String(d.body ?? ""),
        lang,
        JSON.stringify(steps),
        match,
        match === "new" ? null : target,
        match === "merge" ? String(d.merged_body ?? d.body ?? "") : null,
        d.reason ? String(d.reason) : null,
        now(),
        isCritical ? "approved" : "waiting",
        isCritical ? 1 : 0,
        isCritical ? now() : null,
      );
      if (isCritical) critical.push({ draftId: ins.id, match, target: match === "new" ? null : target });
    }
    run("UPDATE talks SET drafted_at = ? WHERE id = ?", startedAt, talkId);
  });
  await autoSave(talkId, critical);
  // translate the title for the helper's list
  const t = one<{ title: string | null }>("SELECT title FROM talks WHERE id = ?", talkId);
  if (t?.title) {
    try {
      run("UPDATE talks SET title_tr = ? WHERE id = ?", JSON.stringify(await translateAll(t.title, lang)), talkId);
    } catch {
      /* the title shows in its original language */
    }
  }
}

/**
 * Critical points skip the approval step: each goes straight into the Notebook (new, merged or replacing its
 * entry, as the drafter matched it), is translated for the helper like any entry, and is marked as auto-added
 * from this talk. Its draft row stays, already approved and flagged auto, so the talk can say what was saved.
 */
async function autoSave(talkId: number, items: { draftId: number; match: "new" | "merge" | "replace"; target: number | null }[]) {
  if (!items.length) return;
  const by = one<User>(
    `SELECT u.id, u.login, u.name, u.role, u.is_admin, u.lang, u.created_at FROM talks t JOIN users u ON u.id = t.created_by WHERE t.id = ?`,
    talkId,
  );
  if (!by) return;
  for (const it of items) {
    const d = toDraft(one<R>("SELECT * FROM drafts WHERE id = ?", it.draftId)!);
    try {
      let entryId: number;
      if (it.match !== "new" && d.target) {
        entryId = d.target.id;
        await saveEntry(by, entryId, it.match === "merge" ? { body: d.merged_body ?? d.body, lang: d.lang } : { title: d.title, body: d.body, lang: d.lang, steps: d.steps });
      } else {
        entryId = (await createEntry(by, { section: d.section, title: d.title, body: d.body, lang: d.lang, steps: d.steps, source_talk_id: talkId })).id;
      }
      run("UPDATE entries SET auto_talk_id = ? WHERE id = ?", talkId, entryId);
      run("UPDATE drafts SET entry_id = ? WHERE id = ?", entryId, it.draftId);
    } catch (e) {
      // not saved after all: it waits for approval like any other draft
      console.error("auto-save failed", (e as Error).message);
      run("UPDATE drafts SET status = 'waiting', auto = 0, decided_at = NULL WHERE id = ?", it.draftId);
    }
  }
}

function toDraft(r: R): Draft {
  const target = r.target_entry_id ? one<R>("SELECT * FROM entries WHERE id = ?", r.target_entry_id) : undefined;
  return {
    id: r.id as number,
    talk_id: r.talk_id as number,
    kind: r.kind as Draft["kind"],
    section: r.section as Section,
    title: r.title as string,
    body: r.body as string,
    lang: asLang(r.lang),
    steps: parseJson(r.steps, []),
    match: r.match as Draft["match"],
    target: target && !target.removed_at ? toEntry(target, null) : null,
    merged_body: (r.merged_body as string) ?? null,
    reason: (r.reason as string) ?? null,
    status: r.status as Draft["status"],
    // an auto-added entry the employer has since removed no longer shows as saved
    entry_id: r.entry_id && (!r.auto || one("SELECT 1 FROM entries WHERE id = ? AND removed_at IS NULL", r.entry_id)) ? (r.entry_id as number) : null,
    task_id: (r.task_id as number) ?? null,
    auto: !!r.auto,
  };
}

/** Waiting drafts the employer can reach: a talk whose every row was binned leaves History, so its drafts no longer count (5.1). */
export function waitingDraftCount(): number {
  return (
    one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM drafts d WHERE d.status = 'waiting' AND EXISTS (SELECT 1 FROM talk_lines l WHERE l.talk_id = d.talk_id)",
    )?.n ?? 0
  );
}

/**
 * Approve a draft into the Notebook. `as` decides how: new entry, merge into the target, or replace it.
 * The employer may have edited title/body/merged text first.
 */
export async function approveDraft(
  user: User,
  draftId: number,
  input: { as?: "new" | "merge" | "replace"; title?: string; body?: string; section?: Section },
): Promise<{ entry: Entry }> {
  const r = one<R>("SELECT * FROM drafts WHERE id = ?", draftId);
  if (!r) throw new ApiError(404, "not_found");
  const d = toDraft(r);
  if (d.status !== "waiting") throw new ApiError(409, "already_decided");
  const as = input.as ?? d.match;
  const title = (input.title ?? d.title).trim() || d.title;
  const section = input.section && SECTIONS.includes(input.section) ? input.section : d.section;
  let entryId: number;
  if (as !== "new" && d.target) {
    const body = (input.body ?? (as === "merge" ? (d.merged_body ?? d.body) : d.body)).trim();
    entryId = d.target.id;
    await saveEntry(user, entryId, { title: as === "replace" ? title : d.target.title === "" ? title : (input.title ?? d.target.title), body, lang: d.lang, steps: d.steps });
  } else {
    entryId = (
      await createEntry(user, {
        section,
        title,
        body: (input.body ?? d.body).trim(),
        lang: d.lang,
        steps: d.steps,
        source_talk_id: d.talk_id,
      })
    ).id;
  }
  run("UPDATE drafts SET status = 'approved', entry_id = ?, decided_at = ?, decided_by = ? WHERE id = ?", entryId, now(), user.id, draftId);
  return { entry: entryById(entryId, user) };
}

export function dropDraft(user: User, draftId: number) {
  const res = run("UPDATE drafts SET status = 'dropped', decided_at = ?, decided_by = ? WHERE id = ? AND status = 'waiting'", now(), user.id, draftId);
  if (!res.changes) throw new ApiError(409, "already_decided");
}

export function editDraft(draftId: number, input: { title?: string; body?: string; merged_body?: string }) {
  const r = one<R>("SELECT * FROM drafts WHERE id = ? AND status = 'waiting'", draftId);
  if (!r) throw new ApiError(404, "not_found");
  run(
    "UPDATE drafts SET title = ?, body = ?, merged_body = ? WHERE id = ?",
    (input.title ?? (r.title as string)).slice(0, 120),
    input.body ?? r.body,
    input.merged_body ?? r.merged_body,
    draftId,
  );
  return toDraft(one<R>("SELECT * FROM drafts WHERE id = ?", draftId)!);
}

export async function draftToTask(user: User, draftId: number) {
  const r = one<R>("SELECT * FROM drafts WHERE id = ?", draftId);
  if (!r) throw new ApiError(404, "not_found");
  const d = toDraft(r);
  const task = await createTask(user, {
    title: d.title,
    note: d.body,
    lang: d.lang,
    kind: "once",
    date: today(),
    time: null,
    weekdays: [],
    photo: d.steps.find((s) => s.photo)?.photo ?? null,
  });
  run("UPDATE drafts SET task_id = ? WHERE id = ?", task.id, draftId);
  return task;
}

// ---------------------------------------------------------------- notebook entries

type EntryTr = { title?: Texts; body?: Texts; steps?: Texts[] };

function toEntry(r: R, viewer: User | null): Entry {
  const tr = parseJson<EntryTr>(r.tr, {});
  const rawSteps = parseJson<{ text: string; photo: string | null }[]>(r.steps, []);
  const steps: Step[] = rawSteps.map((s, i) => ({ text: s.text, photo: s.photo ?? null, tr: tr.steps?.[i] ?? null }));
  const version = r.version as number;
  const helper = one<{ id: number }>("SELECT id FROM users WHERE role = 'helper' AND removed_at IS NULL ORDER BY created_at LIMIT 1");
  const helperRead = helper
    ? one<{ understood_version: number; understood_at: number | null }>(
        "SELECT understood_version, understood_at FROM entry_reads WHERE entry_id = ? AND user_id = ?",
        r.id,
        helper.id,
      )
    : undefined;
  const mine = viewer?.role === "helper" ? one<{ seen_version: number }>("SELECT seen_version FROM entry_reads WHERE entry_id = ? AND user_id = ?", r.id, viewer.id) : undefined;
  return {
    id: r.id as number,
    section: r.section as Section,
    title: r.title as string,
    body: r.body as string,
    lang: asLang(r.lang),
    title_tr: tr.title ?? null,
    body_tr: tr.body ?? null,
    photos: parseJson<string[]>(r.photos, []),
    steps,
    phone: (r.phone as string) || null,
    emergency: !!r.emergency,
    pos: r.pos as number,
    version,
    updated_at: r.updated_at as number,
    source_talk_id: r.source_talk_id && talkShown(r.source_talk_id, viewer) ? (r.source_talk_id as number) : null,
    auto_from: autoFrom(r.auto_talk_id, viewer),
    understood_at: helperRead && helperRead.understood_version >= version ? helperRead.understood_at : null,
    is_new: viewer?.role === "helper" ? (mine?.seen_version ?? 0) < version : false,
    open_questions:
      one<{ n: number }>("SELECT COUNT(*) AS n FROM questions WHERE ref_type = 'entry' AND ref_id = ? AND answer IS NULL", r.id)?.n ?? 0,
  };
}

/** Whether the viewer may open this talk (an entry drafted from a talk she cannot see stays hers to read, without the link). */
function talkShown(talkId: unknown, viewer: User | null): boolean {
  if (!talksSince(viewer)) return true;
  const t = one<{ created_at: number }>("SELECT created_at FROM talks WHERE id = ?", talkId);
  return !!t && talkVisible(viewer, t.created_at);
}

function autoFrom(talkId: unknown, viewer: User | null): Entry["auto_from"] {
  if (!talkId) return null;
  const t = one<R>("SELECT id, lang, title, title_tr, created_at FROM talks WHERE id = ?", talkId);
  if (!t) return null;
  // a talk from before the helper joined: she keeps the mark and its date, never its title or id
  if (!talkVisible(viewer, t.created_at as number)) return { talk_id: 0, title: null, title_tr: null, lang: asLang(t.lang), at: t.created_at as number };
  return { talk_id: t.id as number, title: (t.title as string) ?? null, title_tr: parseJson<Texts | null>(t.title_tr, null), lang: asLang(t.lang), at: t.created_at as number };
}

export function listEntries(viewer: User): Entry[] {
  return all<R>("SELECT * FROM entries WHERE removed_at IS NULL ORDER BY CASE section WHEN 'purpose' THEN 0 WHEN 'rules' THEN 1 WHEN 'instructions' THEN 2 ELSE 3 END, emergency DESC, pos, id").map((r) =>
    toEntry(r, viewer),
  );
}

export function entryById(id: number, viewer: User | null): Entry {
  const r = one<R>("SELECT * FROM entries WHERE id = ? AND removed_at IS NULL", id);
  if (!r) throw new ApiError(404, "not_found");
  return toEntry(r, viewer);
}

export async function translateEntry(id: number) {
  const r = one<R>("SELECT * FROM entries WHERE id = ?", id);
  if (!r) return;
  const steps = parseJson<{ text: string }[]>(r.steps, []);
  const fields: Record<string, string> = { title: r.title as string, body: r.body as string };
  steps.forEach((s, i) => (fields[`s${i}`] = s.text));
  try {
    const t = await translateFields(fields, asLang(r.lang));
    const tr: EntryTr = { title: t.title, body: t.body, steps: steps.map((_, i) => t[`s${i}`]) };
    run("UPDATE entries SET tr = ? WHERE id = ? AND version = ?", JSON.stringify(tr), id, r.version);
  } catch (e) {
    console.error("translate entry failed", (e as Error).message);
  }
}

export type EntryInput = {
  section?: Section;
  title: string;
  body: string;
  lang: Lang;
  photos?: string[];
  steps?: { text: string; photo: string | null }[];
  phone?: string | null;
  emergency?: boolean;
  source_talk_id?: number | null;
};

export async function createEntry(user: User, input: EntryInput): Promise<Entry> {
  const section = input.section && SECTIONS.includes(input.section) ? input.section : "instructions";
  const title = input.title.trim();
  if (!title) throw new ApiError(400, "title_required");
  const pos = (one<{ p: number }>("SELECT COALESCE(MAX(pos), 0) + 1 AS p FROM entries WHERE section = ?", section)?.p ?? 1) as number;
  const { id } = run(
    `INSERT INTO entries (section, title, body, lang, photos, steps, phone, emergency, pos, source_talk_id, created_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    section,
    title.slice(0, 200),
    input.body ?? "",
    input.lang,
    JSON.stringify(input.photos ?? []),
    JSON.stringify(input.steps ?? []),
    input.phone?.trim() || null,
    input.emergency ? 1 : 0,
    pos,
    input.source_talk_id ?? null,
    user.id,
    now(),
    now(),
  );
  await translateEntry(id);
  return entryById(id, user);
}

/** Any change to an entry's words bumps its version: she is asked to confirm it again and sees it as new. */
export async function saveEntry(user: User, id: number, input: Partial<EntryInput>): Promise<Entry> {
  const r = one<R>("SELECT * FROM entries WHERE id = ? AND removed_at IS NULL", id);
  if (!r) throw new ApiError(404, "not_found");
  const title = input.title !== undefined ? input.title.trim() || (r.title as string) : (r.title as string);
  const body = input.body !== undefined ? input.body : (r.body as string);
  const steps = input.steps !== undefined ? JSON.stringify(input.steps) : (r.steps as string);
  const photos = input.photos !== undefined ? JSON.stringify(input.photos) : (r.photos as string);
  const phone = input.phone !== undefined ? input.phone?.trim() || null : r.phone;
  const changedWords = title !== r.title || body !== r.body || steps !== (r.steps ?? "[]") || phone !== r.phone;
  const changedAny = changedWords || photos !== r.photos || (input.section && input.section !== r.section) || (input.emergency !== undefined && (input.emergency ? 1 : 0) !== r.emergency);
  if (!changedAny) return toEntry(r, user);
  run(
    `UPDATE entries SET section = ?, title = ?, body = ?, lang = ?, photos = ?, steps = ?, phone = ?, emergency = ?,
     version = version + ?, updated_at = ? WHERE id = ?`,
    input.section && SECTIONS.includes(input.section) ? input.section : r.section,
    title.slice(0, 200),
    body,
    changedWords ? (input.lang ?? r.lang) : r.lang,
    photos,
    steps,
    phone,
    input.emergency !== undefined ? (input.emergency ? 1 : 0) : r.emergency,
    1,
    now(),
    id,
  );
  if (changedWords) await translateEntry(id);
  return entryById(id, user);
}

export function removeEntry(id: number) {
  const res = run("UPDATE entries SET removed_at = ? WHERE id = ? AND removed_at IS NULL", now(), id);
  if (!res.changes) throw new ApiError(404, "not_found");
}

export function reorderEntries(section: Section, ids: number[]) {
  tx(() => ids.forEach((id, i) => run("UPDATE entries SET pos = ? WHERE id = ? AND section = ?", i + 1, id, section)));
}

export function markSeen(user: User, entryId: number) {
  if (user.role !== "helper") return;
  const e = one<{ version: number }>("SELECT version FROM entries WHERE id = ?", entryId);
  if (!e) return;
  run(
    `INSERT INTO entry_reads (entry_id, user_id, seen_version) VALUES (?,?,?)
     ON CONFLICT(entry_id, user_id) DO UPDATE SET seen_version = excluded.seen_version`,
    entryId,
    user.id,
    e.version,
  );
}

export function markUnderstood(user: User, entryId: number) {
  if (user.role !== "helper") throw new ApiError(403, "helper_only");
  const e = one<{ version: number }>("SELECT version FROM entries WHERE id = ? AND removed_at IS NULL", entryId);
  if (!e) throw new ApiError(404, "not_found");
  run(
    `INSERT INTO entry_reads (entry_id, user_id, seen_version, understood_version, understood_at) VALUES (?,?,?,?,?)
     ON CONFLICT(entry_id, user_id) DO UPDATE SET seen_version = excluded.seen_version, understood_version = excluded.understood_version, understood_at = excluded.understood_at`,
    entryId,
    user.id,
    e.version,
    e.version,
    now(),
  );
  return entryById(entryId, user);
}

// ---------------------------------------------------------------- her notes

type NoteTr = { title?: Texts; body?: Texts };

function toNote(r: R): Note {
  const tr = parseJson<NoteTr>(r.tr, {});
  return {
    id: r.id as number,
    owner_id: r.owner_id as number,
    owner_name: (r.owner_name as string) ?? "",
    collection_id: (r.collection_id as number) ?? null,
    collection_name: (r.collection_name as string) ?? null,
    title: r.title as string,
    body: r.body as string,
    lang: asLang(r.lang),
    title_tr: tr.title ?? null,
    body_tr: tr.body ?? null,
    photos: parseJson<string[]>(r.photos, []),
    shared: !!r.shared,
    created_at: r.created_at as number,
    updated_at: r.updated_at as number,
  };
}

const NOTE_SELECT = `SELECT n.*, u.name AS owner_name, c.name AS collection_name FROM notes n
  JOIN users u ON u.id = n.owner_id LEFT JOIN collections c ON c.id = n.collection_id`;

/** Her own notes, plus any note shared with the family. Private notes are only ever returned to their owner. */
export function listNotes(user: User): Note[] {
  return all<R>(`${NOTE_SELECT} WHERE n.owner_id = ? OR n.shared = 1 ORDER BY n.updated_at DESC`, user.id).map(toNote);
}

export function noteFor(user: User, id: number): Note {
  const r = one<R>(`${NOTE_SELECT} WHERE n.id = ? AND (n.owner_id = ? OR n.shared = 1)`, id, user.id);
  if (!r) throw new ApiError(404, "not_found");
  return toNote(r);
}

async function translateNote(id: number) {
  const r = one<R>("SELECT * FROM notes WHERE id = ?", id);
  if (!r || !r.shared) return; // private notes are never sent anywhere
  try {
    const t = await translateFields({ title: r.title as string, body: r.body as string }, asLang(r.lang));
    run("UPDATE notes SET tr = ? WHERE id = ? AND updated_at = ?", JSON.stringify({ title: t.title, body: t.body }), id, r.updated_at);
  } catch (e) {
    console.error("translate note failed", (e as Error).message);
  }
}

function ownCollection(user: User, id: unknown): number | null {
  if (id === null || id === undefined || id === "") return null;
  const c = one<{ id: number }>("SELECT id FROM collections WHERE id = ? AND owner_id = ?", Number(id), user.id);
  if (!c) throw new ApiError(400, "bad_collection");
  return c.id;
}

export async function createNote(
  user: User,
  input: { title: string; body: string; lang: Lang; collection_id?: number | null; photos?: string[]; shared?: boolean },
) {
  if (!input.title.trim() && !input.body.trim() && !(input.photos?.length)) throw new ApiError(400, "empty");
  const { id } = run(
    "INSERT INTO notes (owner_id, collection_id, title, body, lang, photos, shared, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    user.id,
    ownCollection(user, input.collection_id),
    input.title.trim().slice(0, 200),
    input.body,
    input.lang,
    JSON.stringify(input.photos ?? []),
    input.shared ? 1 : 0,
    now(),
    now(),
  );
  if (input.shared) await translateNote(id);
  return noteFor(user, id);
}

export async function saveNote(
  user: User,
  id: number,
  input: Partial<{ title: string; body: string; lang: Lang; collection_id: number | null; photos: string[]; shared: boolean }>,
) {
  const r = one<R>("SELECT * FROM notes WHERE id = ? AND owner_id = ?", id, user.id);
  if (!r) throw new ApiError(404, "not_found");
  run(
    "UPDATE notes SET title = ?, body = ?, lang = ?, collection_id = ?, photos = ?, shared = ?, tr = ?, updated_at = ? WHERE id = ?",
    input.title !== undefined ? input.title.trim().slice(0, 200) : r.title,
    input.body ?? r.body,
    input.lang ?? r.lang,
    input.collection_id !== undefined ? ownCollection(user, input.collection_id) : r.collection_id,
    input.photos ? JSON.stringify(input.photos) : r.photos,
    input.shared !== undefined ? (input.shared ? 1 : 0) : r.shared,
    input.title !== undefined || input.body !== undefined ? null : r.tr,
    now(),
    id,
  );
  const after = one<R>("SELECT * FROM notes WHERE id = ?", id)!;
  if (after.shared && !after.tr) await translateNote(id);
  if (!after.shared) run("UPDATE notes SET tr = NULL WHERE id = ?", id);
  return noteFor(user, id);
}

export function deleteNote(user: User, id: number) {
  const res = run("DELETE FROM notes WHERE id = ? AND owner_id = ?", id, user.id);
  if (!res.changes) throw new ApiError(404, "not_found");
}

export function listCollections(user: User) {
  return all<{ id: number; name: string; count: number }>(
    "SELECT c.id, c.name, (SELECT COUNT(*) FROM notes n WHERE n.collection_id = c.id) AS count FROM collections c WHERE c.owner_id = ? ORDER BY c.name COLLATE NOCASE",
    user.id,
  );
}

export function createCollection(user: User, name: string) {
  const n = name.trim().slice(0, 60);
  if (!n) throw new ApiError(400, "empty");
  const dup = one<{ id: number }>("SELECT id FROM collections WHERE owner_id = ? AND name = ? COLLATE NOCASE", user.id, n);
  if (dup) return { id: dup.id, name: n, count: 0 };
  return { id: run("INSERT INTO collections (owner_id, name, created_at) VALUES (?,?,?)", user.id, n, now()).id, name: n, count: 0 };
}

export function renameCollection(user: User, id: number, name: string) {
  const n = name.trim().slice(0, 60);
  if (!n) throw new ApiError(400, "empty");
  if (!run("UPDATE collections SET name = ? WHERE id = ? AND owner_id = ?", n, id, user.id).changes) throw new ApiError(404, "not_found");
}

export function deleteCollection(user: User, id: number) {
  if (!run("DELETE FROM collections WHERE id = ? AND owner_id = ?", id, user.id).changes) throw new ApiError(404, "not_found");
}

// ---------------------------------------------------------------- tasks

type TaskTr = { title?: Texts; note?: Texts };

function repeatOf(r: R): Task["repeat"] {
  if (r.kind === "once") return "none";
  if (r.repeat === "monthly" || r.repeat === "weekly" || r.repeat === "daily") return r.repeat;
  const days = parseJson<number[]>(r.weekdays, []);
  return days.length > 0 && days.length < 7 ? "weekly" : "daily";
}

/** One task as it stands on `date`: its tick is that date's tick. `done` skips the lookup when the caller has it. */
function toTask(r: R, date: string, opts: { done?: number | null; movedFrom?: string | null } = {}): Task {
  const tr = parseJson<TaskTr>(r.tr, {});
  const doneAt =
    opts.done !== undefined ? opts.done : (one<{ at: number }>("SELECT at FROM task_done WHERE task_id = ? AND date = ?", r.id, date)?.at ?? null);
  return {
    id: r.id as number,
    title: r.title as string,
    note: r.note as string,
    lang: asLang(r.lang),
    title_tr: tr.title ?? null,
    note_tr: tr.note ?? null,
    time: (r.time as string) || null,
    photo: (r.photo_id as string) || null,
    kind: r.kind as Task["kind"],
    repeat: repeatOf(r),
    weekdays: parseJson<number[]>(r.weekdays, []),
    date: (r.date as string) || null,
    start_date: r.kind === "routine" ? ((r.start_date as string) || null) : null,
    moved_from: opts.movedFrom ?? null,
    done_at: doneAt,
  };
}

export async function translateTask(id: number) {
  const r = one<R>("SELECT * FROM tasks WHERE id = ?", id);
  if (!r) return;
  try {
    const t = await translateFields({ title: r.title as string, note: r.note as string }, asLang(r.lang));
    run("UPDATE tasks SET tr = ? WHERE id = ? AND updated_at = ?", JSON.stringify({ title: t.title, note: t.note }), id, r.updated_at);
  } catch (e) {
    console.error("translate task failed", (e as Error).message);
  }
}

export type TaskInput = {
  title: string;
  note: string;
  lang: Lang;
  kind: "routine" | "once";
  /** 2.0: daily, weekly (weekdays) or monthly; derived from weekdays when absent */
  repeat?: Task["repeat"];
  weekdays: number[];
  /** one-off: its date; routine: the date it starts (default today) */
  date: string | null;
  time: string | null;
  photo: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function cleanTask(input: Partial<TaskInput>) {
  const time = input.time && /^\d{2}:\d{2}$/.test(input.time) ? input.time : null;
  const weekdays = [...new Set((input.weekdays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const date = isDate(input.date) ? input.date : null;
  return { time, weekdays, date };
}

/** The routine's repeat column for what the form sent: monthly as asked, otherwise weekly when some (not all) days are picked. */
function routineRepeat(repeat: Task["repeat"] | undefined, weekdays: number[]): "daily" | "weekly" | "monthly" {
  if (repeat === "monthly") return "monthly";
  if (repeat === "daily") return "daily";
  return weekdays.length > 0 && weekdays.length < 7 ? "weekly" : "daily";
}

export async function createTask(user: User, input: TaskInput): Promise<Task> {
  const title = input.title.trim();
  if (!title) throw new ApiError(400, "title_required");
  const { time, weekdays, date } = cleanTask(input);
  const kind = input.kind === "routine" || (input.repeat && input.repeat !== "none") ? "routine" : "once";
  const repeat = kind === "routine" ? routineRepeat(input.repeat, weekdays) : null;
  if (repeat === "weekly" && weekdays.length === 0) throw new ApiError(400, "weekdays_required");
  const day = date ?? today();
  const { id } = run(
    "INSERT INTO tasks (title, note, lang, time, photo_id, kind, weekdays, date, repeat, start_date, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    title.slice(0, 200),
    input.note ?? "",
    input.lang,
    time,
    input.photo ?? null,
    kind,
    JSON.stringify(repeat === "weekly" ? weekdays : []),
    kind === "once" ? day : null,
    repeat,
    kind === "routine" ? day : null,
    user.id,
    now(),
    now(),
  );
  await translateTask(id);
  return toTask(one<R>("SELECT * FROM tasks WHERE id = ?", id)!, day);
}

export async function saveTask(id: number, input: Partial<TaskInput>): Promise<Task> {
  const r = one<R>("SELECT * FROM tasks WHERE id = ? AND removed_at IS NULL", id);
  if (!r) throw new ApiError(404, "not_found");
  const c = cleanTask({ time: input.time === undefined ? (r.time as string) : input.time, weekdays: input.weekdays ?? parseJson(r.weekdays, []), date: input.date === undefined ? (r.date as string) : input.date });
  const kind = input.kind ?? (r.kind as TaskInput["kind"]);
  const title = input.title !== undefined ? input.title.trim() || (r.title as string) : (r.title as string);
  const note = input.note ?? (r.note as string);
  const words = title !== r.title || note !== r.note;
  const wasRoutine = r.kind === "routine";
  // a monthly routine edited on Today (which has no monthly choice) stays monthly unless days are picked
  const repeat =
    kind === "routine"
      ? r.repeat === "monthly" && input.repeat === undefined && !input.weekdays?.length
        ? "monthly"
        : routineRepeat(input.repeat, c.weekdays)
      : null;
  const start = kind === "routine" ? (wasRoutine && r.start_date ? (r.start_date as string) : today()) : null;
  run(
    "UPDATE tasks SET title = ?, note = ?, lang = ?, time = ?, photo_id = ?, kind = ?, weekdays = ?, date = ?, repeat = ?, start_date = ?, updated_at = ?, tr = ? WHERE id = ?",
    title,
    note,
    words ? (input.lang ?? r.lang) : r.lang,
    c.time,
    input.photo !== undefined ? input.photo : r.photo_id,
    kind,
    JSON.stringify(repeat === "weekly" ? c.weekdays : []),
    kind === "once" ? (c.date ?? today()) : null,
    repeat,
    start,
    now(),
    words ? null : r.tr,
    id,
  );
  if (words) await translateTask(id);
  return toTask(one<R>("SELECT * FROM tasks WHERE id = ?", id)!, today());
}

export function removeTask(id: number) {
  if (!run("UPDATE tasks SET removed_at = ? WHERE id = ? AND removed_at IS NULL", now(), id).changes) throw new ApiError(404, "not_found");
}

function lastDayOfMonth(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Does the series itself (before any move) fall on `date`? Repeats never show before their start date. */
export function seriesOn(r: R, date: string): boolean {
  if (r.kind === "once") return r.date === date;
  const start = (r.start_date as string) || null;
  if (start && date < start) return false;
  // 3.0: a routine whose template was taken off the calendar stops after its end date
  if (r.end_date && date > (r.end_date as string)) return false;
  // 4.0: first-week days that already had this task when its template was applied
  if (r.skip_dates && parseJson<string[]>(r.skip_dates, []).includes(date)) return false;
  const rep = repeatOf(r);
  if (rep === "daily") return true;
  if (rep === "weekly") return parseJson<number[]>(r.weekdays, []).includes(weekday(date));
  // monthly: the start date's day, or the month's last day when the month is too short
  const want = Number((start ?? (r.created_at ? today(new Date(r.created_at as number)) : date)).slice(8, 10));
  return Number(date.slice(8, 10)) === Math.min(want, lastDayOfMonth(date));
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type Move = { task_id: number; from_date: string; to_date: string };

/** Tasks on each date from `from` to `to` (inclusive): series occurrences not moved away, plus occurrences moved in. */
export function tasksForRange(from: string, to: string): Map<string, Task[]> {
  const rows = all<R>("SELECT * FROM tasks WHERE removed_at IS NULL ORDER BY COALESCE(time, '99:99'), id");
  const moves = all<Move>("SELECT * FROM task_moves");
  const movedAway = new Set(moves.map((mv) => `${mv.task_id}|${mv.from_date}`));
  const done = new Map(
    all<{ task_id: number; date: string; at: number }>("SELECT task_id, date, at FROM task_done WHERE date >= ? AND date <= ?", from, to).map((d) => [`${d.task_id}|${d.date}`, d.at]),
  );
  const out = new Map<string, Task[]>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list: Task[] = [];
    for (const r of rows) {
      const key = `${r.id}|${d}`;
      const movedIn = r.kind === "routine" ? moves.find((mv) => mv.task_id === r.id && mv.to_date === d) : undefined;
      if (movedIn && !(r.end_date && d > (r.end_date as string))) list.push(toTask(r, d, { done: done.get(key) ?? null, movedFrom: movedIn.from_date }));
      else if (seriesOn(r, d) && !movedAway.has(key)) list.push(toTask(r, d, { done: done.get(key) ?? null }));
    }
    out.set(d, list);
  }
  return out;
}

export function tasksFor(date: string): Task[] {
  return tasksForRange(date, date).get(date) ?? [];
}

export function allTasks(): Task[] {
  const d = today();
  return all<R>("SELECT * FROM tasks WHERE removed_at IS NULL AND ((kind = 'routine' AND (end_date IS NULL OR end_date >= ?)) OR date >= ?) ORDER BY kind DESC, COALESCE(time, '99:99'), id", d, d).map((r) => toTask(r, d));
}

/**
 * Move one task off `from` onto `to` (today or later). A one-off task changes its date. For a routine only that
 * date's occurrence moves (a row in task_moves); the rest of the series stays where it is.
 */
export function moveTask(id: number, from: string, to: string): { task: Task; to: string } {
  if (!isDate(from) || !isDate(to)) throw new ApiError(400, "bad_date");
  if (to < today()) throw new ApiError(400, "past_date");
  const r = one<R>("SELECT * FROM tasks WHERE id = ? AND removed_at IS NULL", id);
  if (!r) throw new ApiError(404, "not_found");
  if (from === to) return { task: toTask(r, to), to };
  if (r.kind === "once") {
    if (r.date !== from) throw new ApiError(404, "not_on_date");
    run("UPDATE tasks SET date = ?, updated_at = ? WHERE id = ?", to, now(), id);
    return { task: toTask(one<R>("SELECT * FROM tasks WHERE id = ?", id)!, to), to };
  }
  return tx(() => {
    const moves = all<Move>("SELECT * FROM task_moves WHERE task_id = ?", id);
    const movedIn = moves.find((mv) => mv.to_date === from);
    const origin = movedIn ? movedIn.from_date : from;
    if (!movedIn && (!seriesOn(r, from) || moves.some((mv) => mv.from_date === from))) throw new ApiError(404, "not_on_date");
    const onTarget = moves.some((mv) => mv.to_date === to) || (seriesOn(r, to) && !moves.some((mv) => mv.from_date === to) && to !== origin);
    if (onTarget) throw new ApiError(409, "already_on_date");
    run("DELETE FROM task_moves WHERE task_id = ? AND from_date = ?", id, origin);
    if (to !== origin) run("INSERT INTO task_moves (task_id, from_date, to_date) VALUES (?,?,?)", id, origin, to);
    return { task: toTask(r, to, { movedFrom: to !== origin ? origin : null }), to };
  });
}

export function setDone(user: User, taskId: number, done: boolean) {
  const date = today();
  if (!one("SELECT id FROM tasks WHERE id = ? AND removed_at IS NULL", taskId)) throw new ApiError(404, "not_found");
  if (done) run("INSERT OR IGNORE INTO task_done (task_id, date, user_id, at) VALUES (?,?,?,?)", taskId, date, user.id, now());
  else run("DELETE FROM task_done WHERE task_id = ? AND date = ?", taskId, date);
  return toTask(one<R>("SELECT * FROM tasks WHERE id = ?", taskId)!, date);
}

// ---------------------------------------------------------------- calendar: events and days off

function toItem(r: R): CalItem {
  return {
    id: r.id as number,
    kind: r.kind as CalItem["kind"],
    date: r.date as string,
    title: r.title as string,
    lang: asLang(r.lang),
    title_tr: parseJson<{ title?: Texts }>(r.tr, {}).title ?? null,
    time: (r.time as string) || null,
  };
}

export function itemsForRange(from: string, to: string): CalItem[] {
  return all<R>("SELECT * FROM cal_items WHERE date >= ? AND date <= ? ORDER BY date, kind DESC, COALESCE(time, '99:99'), id", from, to).map(toItem);
}

export async function createItem(user: User, input: { kind: CalItem["kind"]; date: string; title: string; time: string | null; lang: Lang }): Promise<CalItem> {
  if (!isDate(input.date)) throw new ApiError(400, "bad_date");
  if (input.date < today()) throw new ApiError(400, "past_date");
  const time = input.time && /^\d{2}:\d{2}$/.test(input.time) ? input.time : null;
  if (input.kind === "dayoff") {
    const have = one<R>("SELECT * FROM cal_items WHERE kind = 'dayoff' AND date = ?", input.date);
    if (have) return toItem(have);
    const { id } = run("INSERT INTO cal_items (kind, date, title, lang, created_by, created_at) VALUES ('dayoff',?,'',?,?,?)", input.date, input.lang, user.id, now());
    return toItem(one<R>("SELECT * FROM cal_items WHERE id = ?", id)!);
  }
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new ApiError(400, "title_required");
  const { id } = run("INSERT INTO cal_items (kind, date, title, lang, time, created_by, created_at) VALUES ('event',?,?,?,?,?,?)", input.date, title, input.lang, time, user.id, now());
  try {
    const t = await translateFields({ title }, input.lang);
    run("UPDATE cal_items SET tr = ? WHERE id = ?", JSON.stringify({ title: t.title }), id);
  } catch (e) {
    console.error("translate event failed", (e as Error).message);
  }
  return toItem(one<R>("SELECT * FROM cal_items WHERE id = ?", id)!);
}

export function deleteItem(id: number) {
  if (!run("DELETE FROM cal_items WHERE id = ?", id).changes) throw new ApiError(404, "not_found");
}

export function calendarRange(from: string, to: string): CalDay[] {
  if (!isDate(from) || !isDate(to) || to < from) throw new ApiError(400, "bad_date");
  if (addDays(from, 62) < to) throw new ApiError(400, "range_too_long");
  const tasks = tasksForRange(from, to);
  const items = itemsForRange(from, to);
  return [...tasks.entries()].map(([date, list]) => ({ date, tasks: list, items: items.filter((i) => i.date === date) }));
}

/** Rows whose time stamp falls on `date` in the household's time zone. */
function onDay(ms: number, date: string) {
  return today(new Date(ms)) === date;
}

/** One date's page: its tasks and events, the talks held then, Notebook entries written or edited then, and notes made then. */
export function dayView(user: User, date: string): DayView {
  if (!isDate(date)) throw new ApiError(400, "bad_date");
  const lo = new Date(date + "T00:00:00Z").getTime() - 86_400_000;
  const hi = lo + 3 * 86_400_000;
  const talks = all<R>(`${TALK_SELECT} WHERE t.created_at >= ? AND t.created_at < ? AND t.created_at >= ? ORDER BY t.created_at`, lo, hi, talksSince(user))
    .filter((r) => onDay(r.created_at as number, date) && (r.line_count as number) > 0)
    .map(toTalk)
    .map((t) => (user.role === "employer" ? t : forHelper(t)));
  const entries = all<R>(
    "SELECT * FROM entries WHERE removed_at IS NULL AND ((created_at >= ? AND created_at < ?) OR (updated_at >= ? AND updated_at < ?)) ORDER BY updated_at",
    lo, hi, lo, hi,
  )
    .filter((r) => onDay(r.created_at as number, date) || onDay(r.updated_at as number, date))
    .map((r) => toEntry(r, user));
  // private notes only to their owner, shared ones to everyone (the same rule as the Notes screens)
  const notes = all<R>(`${NOTE_SELECT} WHERE (n.owner_id = ? OR n.shared = 1) AND n.created_at >= ? AND n.created_at < ? ORDER BY n.created_at`, user.id, lo, hi)
    .filter((r) => onDay(r.created_at as number, date))
    .map(toNote);
  return { date, today: today(), tasks: tasksFor(date), items: itemsForRange(date, date), talks, entries, notes };
}

// ---------------------------------------------------------------- questions

function toQuestion(r: R): Question {
  let refTitle: string | null = null;
  let refTr: Texts | null = null;
  let refLang: Lang | null = null;
  if (r.ref_type === "entry" && r.ref_id) {
    const e = one<R>("SELECT title, tr, lang FROM entries WHERE id = ?", r.ref_id);
    if (e) {
      refTitle = e.title as string;
      refTr = parseJson<EntryTr>(e.tr, {}).title ?? null;
      refLang = asLang(e.lang);
    }
  } else if (r.ref_type === "task" && r.ref_id) {
    const t = one<R>("SELECT title, tr, lang FROM tasks WHERE id = ?", r.ref_id);
    if (t) {
      refTitle = t.title as string;
      refTr = parseJson<TaskTr>(t.tr, {}).title ?? null;
      refLang = asLang(t.lang);
    }
  }
  return {
    id: r.id as number,
    asker_name: (r.asker_name as string) ?? "",
    text: r.text as string,
    lang: asLang(r.lang),
    tr: parseJson<Texts | null>(r.tr, null),
    ref_type: (r.ref_type as Question["ref_type"]) ?? null,
    ref_id: (r.ref_id as number) ?? null,
    ref_title: refTitle,
    ref_title_tr: refTr,
    ref_lang: refLang,
    answer: (r.answer as string) ?? null,
    answer_lang: r.answer_lang ? asLang(r.answer_lang) : null,
    answer_tr: parseJson<Texts | null>(r.answer_tr, null),
    answered_by_name: (r.answered_by_name as string) ?? null,
    answered_at: (r.answered_at as number) ?? null,
    answer_seen: !!r.answer_seen_at,
    created_at: r.created_at as number,
  };
}

const Q_SELECT = `SELECT q.*, a.name AS asker_name, b.name AS answered_by_name FROM questions q
  JOIN users a ON a.id = q.asker_id LEFT JOIN users b ON b.id = q.answered_by`;

export function listQuestions(): Question[] {
  return all<R>(`${Q_SELECT} ORDER BY (q.answer IS NULL) DESC, COALESCE(q.answered_at, q.created_at) DESC LIMIT 200`).map(toQuestion);
}

export function openQuestions(): Question[] {
  return all<R>(`${Q_SELECT} WHERE q.answer IS NULL ORDER BY q.created_at DESC`).map(toQuestion);
}

export function questionById(id: number): Question {
  const r = one<R>(`${Q_SELECT} WHERE q.id = ?`, id);
  if (!r) throw new ApiError(404, "not_found");
  return toQuestion(r);
}

export async function askQuestion(user: User, input: { text: string; lang: Lang; ref_type?: "entry" | "task" | null; ref_id?: number | null }) {
  const text = input.text.trim();
  if (!text) throw new ApiError(400, "empty");
  let refType: "entry" | "task" | null = null;
  let refId: number | null = null;
  if (input.ref_type === "entry" && input.ref_id && one("SELECT id FROM entries WHERE id = ?", input.ref_id)) {
    refType = "entry";
    refId = input.ref_id;
  } else if (input.ref_type === "task" && input.ref_id && one("SELECT id FROM tasks WHERE id = ?", input.ref_id)) {
    refType = "task";
    refId = input.ref_id;
  }
  const { id } = run(
    "INSERT INTO questions (asker_id, text, lang, ref_type, ref_id, created_at) VALUES (?,?,?,?,?,?)",
    user.id,
    text.slice(0, 2000),
    input.lang,
    refType,
    refId,
    now(),
  );
  try {
    run("UPDATE questions SET tr = ? WHERE id = ?", JSON.stringify(await translateAll(text, input.lang)), id);
  } catch (e) {
    console.error("translate question failed", (e as Error).message);
  }
  return questionById(id);
}

export async function answerQuestion(user: User, id: number, input: { text: string; lang: Lang }) {
  const text = input.text.trim();
  if (!text) throw new ApiError(400, "empty");
  if (!one("SELECT id FROM questions WHERE id = ?", id)) throw new ApiError(404, "not_found");
  run(
    "UPDATE questions SET answer = ?, answer_lang = ?, answer_tr = NULL, answered_by = ?, answered_at = ?, answer_seen_at = NULL WHERE id = ?",
    text.slice(0, 2000),
    input.lang,
    user.id,
    now(),
    id,
  );
  try {
    run("UPDATE questions SET answer_tr = ? WHERE id = ?", JSON.stringify(await translateAll(text, input.lang)), id);
  } catch (e) {
    console.error("translate answer failed", (e as Error).message);
  }
  return questionById(id);
}

export function markAnswerSeen(user: User, id: number) {
  run("UPDATE questions SET answer_seen_at = ? WHERE id = ? AND asker_id = ? AND answer IS NOT NULL", now(), id, user.id);
}

/** Retry translations that failed when they were written (AI was down). A few at a time, in the background. */
let filling = false;
export function fillMissingTranslations() {
  if (filling || !aiConfigured()) return;
  filling = true;
  (async () => {
    for (const r of all<{ id: number }>("SELECT id FROM entries WHERE tr IS NULL AND removed_at IS NULL LIMIT 3")) await translateEntry(r.id);
    for (const r of all<{ id: number }>("SELECT id FROM tasks WHERE tr IS NULL AND removed_at IS NULL LIMIT 3")) await translateTask(r.id);
    for (const r of all<{ id: number; text: string; lang: string }>("SELECT id, text, lang FROM questions WHERE tr IS NULL LIMIT 3")) {
      try {
        run("UPDATE questions SET tr = ? WHERE id = ?", JSON.stringify(await translateAll(r.text, asLang(r.lang))), r.id);
      } catch {
        break;
      }
    }
    for (const r of all<{ id: number; answer: string; answer_lang: string }>("SELECT id, answer, answer_lang FROM questions WHERE answer IS NOT NULL AND answer_tr IS NULL LIMIT 3")) {
      try {
        run("UPDATE questions SET answer_tr = ? WHERE id = ?", JSON.stringify(await translateAll(r.answer, asLang(r.answer_lang))), r.id);
      } catch {
        break;
      }
    }
  })()
    .catch(() => {})
    .finally(() => (filling = false));
}

// ---------------------------------------------------------------- today

export function todayView(user: User): TodayView {
  fillMissingTranslations();
  const date = today();
  const tasks = tasksFor(date);
  const done = tasks.filter((t) => t.done_at).length;
  let changed: Entry[] = [];
  let answers: Question[] = [];
  if (user.role === "helper") {
    changed = listEntries(user).filter((e) => e.is_new || !e.understood_at);
    answers = all<R>(
      `${Q_SELECT} WHERE q.asker_id = ? AND q.answer IS NOT NULL AND (q.answer_seen_at IS NULL OR q.answered_at > ?) ORDER BY q.answered_at DESC`,
      user.id,
      now() - 2 * 24 * 3600_000,
    ).map(toQuestion);
  }
  return { date, tasks, done, total: tasks.length, changed, answers, open_questions: openQuestions() };
}

// ---------------------------------------------------------------- search

export function search(user: User, q: string): SearchHit[] {
  const term = q.trim();
  if (term.length < 1) return [];
  const like = `%${term.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
  const hits: SearchHit[] = [];
  const esc = "ESCAPE '\\'";
  for (const r of all<R>(`SELECT * FROM entries WHERE removed_at IS NULL AND (title LIKE ? ${esc} OR body LIKE ? ${esc} OR tr LIKE ? ${esc} OR phone LIKE ? ${esc} OR steps LIKE ? ${esc}) LIMIT 30`, like, like, like, like, like)) {
    const e = toEntry(r, user);
    hits.push({ type: "entry", id: e.id, href: `/notebook/${e.id}`, title: e.title, title_tr: e.title_tr, snippet: e.body.slice(0, 200), snippet_tr: e.body_tr, lang: e.lang });
  }
  for (const r of all<R>(`${NOTE_SELECT} WHERE (n.owner_id = ? OR n.shared = 1) AND (n.title LIKE ? ${esc} OR n.body LIKE ? ${esc} OR n.tr LIKE ? ${esc} OR c.name LIKE ? ${esc}) LIMIT 30`, user.id, like, like, like, like)) {
    const n = toNote(r);
    hits.push({ type: "note", id: n.id, href: `/notes/${n.id}`, title: n.title || n.body.slice(0, 40), title_tr: n.title_tr, snippet: n.body.slice(0, 200), snippet_tr: n.body_tr, lang: n.lang });
  }
  for (const r of all<R>(`SELECT DISTINCT t.* FROM talks t JOIN talk_lines l ON l.talk_id = t.id WHERE t.created_at >= ? AND (l.text LIKE ? ${esc} OR l.tr LIKE ? ${esc} OR t.title LIKE ? ${esc} OR t.title_tr LIKE ? ${esc}) ORDER BY t.updated_at DESC LIMIT 20`, talksSince(user), like, like, like, like)) {
    const line = one<R>(`SELECT * FROM talk_lines WHERE talk_id = ? AND (text LIKE ? ${esc} OR tr LIKE ? ${esc}) LIMIT 1`, r.id, like, like);
    const l = line ? toLine(line) : null;
    hits.push({
      type: "talk",
      id: r.id as number,
      href: `/talks/${r.id}`,
      title: (r.title as string) || "",
      title_tr: parseJson<Texts | null>(r.title_tr, null),
      snippet: l?.text ?? "",
      snippet_tr: l?.tr ?? null,
      lang: l?.lang ?? asLang(r.lang),
    });
  }
  for (const r of all<R>(`SELECT * FROM tasks WHERE removed_at IS NULL AND (title LIKE ? ${esc} OR note LIKE ? ${esc} OR tr LIKE ? ${esc}) LIMIT 20`, like, like, like)) {
    const t = toTask(r, today());
    hits.push({ type: "task", id: t.id, href: `/today#task-${t.id}`, title: t.title, title_tr: t.title_tr, snippet: t.note, snippet_tr: t.note_tr, lang: t.lang });
  }
  for (const r of all<R>(`${Q_SELECT} WHERE q.text LIKE ? ${esc} OR q.tr LIKE ? ${esc} OR q.answer LIKE ? ${esc} OR q.answer_tr LIKE ? ${esc} LIMIT 20`, like, like, like, like)) {
    const qq = toQuestion(r);
    hits.push({ type: "question", id: qq.id, href: `/questions#q-${qq.id}`, title: qq.text, title_tr: qq.tr, snippet: qq.answer ?? "", snippet_tr: qq.answer_tr, lang: qq.lang });
  }
  return hits;
}

export { helperLang };

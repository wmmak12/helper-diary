import { all, now, one, parseJson, run } from "./db";
import { aiConfigured, translateFields } from "./ai";
import { householdLangs } from "./auth";
import { today } from "./api";
import { translateEntry, translateTask } from "./household";
import { translateDish } from "./kitchen";
import { isLang, type Lang, type Texts } from "../languages";

// 5.3: new texts are translated only into the household's languages (lib/server/auth.ts householdLangs). When a member
// joins with, or switches to, a language the household has not used, earlier Notebook entries, tasks (template tasks
// on the calendar too), dishes and coming calendar events are translated into it once, in the background, one item
// at a time. Until an item is done it reads in its original language. An item counts as done when its stored
// translation has that language, and each write merges into what is stored now (checked against the text it
// translated), so a restart mid-way resumes where it stopped and never overwrites existing translations.
// Talk lines are not back-filled.

type R = Record<string, unknown>;
const asLang = (v: unknown): Lang => (isLang(v) ? v : "en");

/** Bring household_langs in line with who is in the household now. A language that comes back is back-filled again. */
export function syncHouseholdLangs(): Lang[] {
  const current = householdLangs();
  for (const l of current) run("INSERT OR IGNORE INTO household_langs (lang, added_at) VALUES (?, ?)", l, now());
  for (const r of all<{ lang: string }>("SELECT lang FROM household_langs")) {
    if (!current.includes(r.lang as Lang)) run("DELETE FROM household_langs WHERE lang = ?", r.lang);
  }
  return all<{ lang: string }>("SELECT lang FROM household_langs WHERE backfilled_at IS NULL ORDER BY added_at, lang")
    .map((r) => r.lang)
    .filter(isLang);
}

const has = (t: Texts | null | undefined, l: Lang) => typeof t?.[l] === "string" && !!t[l]!.trim();
const path = (field: string, l: Lang) => `$.${field}."${l}"`;

async function entryInto(id: number, l: Lang): Promise<boolean> {
  const r = one<R>("SELECT * FROM entries WHERE id = ? AND removed_at IS NULL", id);
  if (!r || r.lang === l) return true;
  if (!r.tr) {
    await translateEntry(id); // never translated at all: the whole thing, into every household language
    return !!one<R>("SELECT tr FROM entries WHERE id = ?", id)?.tr;
  }
  const steps = parseJson<{ text: string }[]>(r.steps, []);
  const fields: Record<string, string> = { title: r.title as string, body: r.body as string };
  steps.forEach((s, i) => (fields[`s${i}`] = s.text));
  const t = await translateFields(fields, asLang(r.lang), [l]);
  // re-read after the wait: an edit meanwhile (new version) is translated by its own save
  const cur = one<R>("SELECT tr, version FROM entries WHERE id = ?", id);
  if (!cur || cur.version !== r.version) return true;
  const tr = parseJson<{ title?: Texts; body?: Texts; steps?: Texts[] }>(cur.tr, {});
  tr.title = { ...tr.title, [l]: t.title[l] };
  if (t.body?.[l] !== undefined) tr.body = { ...tr.body, [l]: t.body[l] };
  tr.steps = steps.map((_, i) => ({ ...(tr.steps?.[i] ?? {}), ...(t[`s${i}`]?.[l] !== undefined ? { [l]: t[`s${i}`][l] } : {}) }));
  run("UPDATE entries SET tr = ? WHERE id = ? AND version = ?", JSON.stringify(tr), id, r.version);
  return true;
}

async function taskInto(id: number, l: Lang): Promise<boolean> {
  const r = one<R>("SELECT * FROM tasks WHERE id = ? AND removed_at IS NULL", id);
  if (!r || r.lang === l) return true;
  if (!r.tr) {
    await translateTask(id);
    return !!one<R>("SELECT tr FROM tasks WHERE id = ?", id)?.tr;
  }
  const t = await translateFields({ title: r.title as string, note: r.note as string }, asLang(r.lang), [l]);
  const cur = one<R>("SELECT tr, updated_at FROM tasks WHERE id = ?", id);
  if (!cur || cur.updated_at !== r.updated_at) return true;
  const tr = parseJson<{ title?: Texts; note?: Texts }>(cur.tr, {});
  tr.title = { ...tr.title, [l]: t.title[l] };
  if (t.note?.[l] !== undefined) tr.note = { ...tr.note, [l]: t.note[l] };
  run("UPDATE tasks SET tr = ? WHERE id = ? AND updated_at = ?", JSON.stringify(tr), id, r.updated_at);
  return true;
}

async function eventInto(id: number, l: Lang): Promise<boolean> {
  const r = one<R>("SELECT * FROM cal_items WHERE id = ?", id);
  if (!r || r.lang === l || !(r.title as string)) return true;
  const t = await translateFields({ title: r.title as string }, asLang(r.lang), [l]);
  const cur = one<R>("SELECT tr, title FROM cal_items WHERE id = ?", id);
  if (!cur || cur.title !== r.title) return true;
  const tr = parseJson<{ title?: Texts }>(cur.tr, {});
  tr.title = { ...tr.title, [l]: t.title[l] };
  run("UPDATE cal_items SET tr = ? WHERE id = ? AND title = ?", JSON.stringify(tr), id, r.title);
  return true;
}

async function dishInto(id: number, l: Lang): Promise<boolean> {
  const r = one<R>("SELECT * FROM dishes WHERE id = ?", id);
  if (!r) return true;
  // whatever was never translated at all goes through the dish's own translation, into every household language
  if (!r.tr || ((r.note as string) && !r.note_tr) || (((r.ingredients as string) || (r.steps as string)) && !r.recipe_tr)) {
    if (!(await translateDish(id))) return false;
  }
  const d = one<R>("SELECT * FROM dishes WHERE id = ?", id);
  if (!d) return true;
  if (d.lang !== l && !has(parseJson<Texts | null>(d.tr, null), l)) {
    const t = await translateFields({ name: d.name as string }, asLang(d.lang), [l]);
    const cur = one<R>("SELECT tr FROM dishes WHERE id = ? AND name = ? AND lang = ?", id, d.name, d.lang);
    if (cur) run("UPDATE dishes SET tr = ? WHERE id = ? AND name = ?", JSON.stringify({ ...parseJson<Texts>(cur.tr, {}), [l]: t.name[l] }), id, d.name);
  }
  if ((d.note as string) && d.note_lang !== l && !has(parseJson<Texts | null>(d.note_tr, null), l)) {
    const t = await translateFields({ note: d.note as string }, asLang(d.note_lang), [l]);
    const cur = one<R>("SELECT note_tr FROM dishes WHERE id = ? AND note = ?", id, d.note);
    if (cur) run("UPDATE dishes SET note_tr = ? WHERE id = ? AND note = ?", JSON.stringify({ ...parseJson<Texts>(cur.note_tr, {}), [l]: t.note[l] }), id, d.note);
  }
  const rtr = parseJson<{ ingredients?: Texts; steps?: Texts } | null>(d.recipe_tr, null);
  const recipeKey = (d.ingredients as string) ? "ingredients" : "steps";
  if (((d.ingredients as string) || (d.steps as string)) && d.recipe_lang !== l && !has(rtr?.[recipeKey], l)) {
    const t = await translateFields({ ingredients: d.ingredients as string, steps: d.steps as string }, asLang(d.recipe_lang), [l]);
    const cur = one<R>("SELECT recipe_tr FROM dishes WHERE id = ? AND ingredients = ? AND steps = ?", id, d.ingredients, d.steps);
    if (cur) {
      const tr = parseJson<{ ingredients?: Texts; steps?: Texts }>(cur.recipe_tr, {});
      if (t.ingredients?.[l] !== undefined) tr.ingredients = { ...tr.ingredients, [l]: t.ingredients[l] };
      if (t.steps?.[l] !== undefined) tr.steps = { ...tr.steps, [l]: t.steps[l] };
      run("UPDATE dishes SET recipe_tr = ? WHERE id = ? AND ingredients = ? AND steps = ?", JSON.stringify(tr), id, d.ingredients, d.steps);
    }
  }
  return true;
}

/** The items still to translate into `l`, as [kind, id]. */
export function pendingFor(l: Lang): ["entry" | "task" | "event" | "dish", number][] {
  const ids = (sql: string, ...p: unknown[]) => all<{ id: number }>(sql, ...p).map((r) => r.id);
  return [
    ...ids("SELECT id FROM entries WHERE removed_at IS NULL AND lang <> ? AND (tr IS NULL OR json_extract(tr, ?) IS NULL) ORDER BY id", l, path("title", l)).map((id) => ["entry", id] as ["entry", number]),
    ...ids("SELECT id FROM tasks WHERE removed_at IS NULL AND lang <> ? AND (tr IS NULL OR json_extract(tr, ?) IS NULL) ORDER BY id", l, path("title", l)).map((id) => ["task", id] as ["task", number]),
    ...ids("SELECT id FROM cal_items WHERE kind = 'event' AND date >= ? AND lang <> ? AND title <> '' AND (tr IS NULL OR json_extract(tr, ?) IS NULL) ORDER BY id", today(), l, path("title", l)).map((id) => ["event", id] as ["event", number]),
    ...ids(
      `SELECT id FROM dishes WHERE (lang <> ? AND (tr IS NULL OR json_extract(tr, ?) IS NULL))
        OR (note <> '' AND note_lang <> ? AND (note_tr IS NULL OR json_extract(note_tr, ?) IS NULL))
        OR ((ingredients <> '' OR steps <> '') AND recipe_lang <> ? AND (recipe_tr IS NULL OR json_extract(recipe_tr, CASE WHEN ingredients <> '' THEN ? ELSE ? END) IS NULL))
        ORDER BY id`,
      l, `$."${l}"`, l, `$."${l}"`, l, path("ingredients", l), path("steps", l),
    ).map((id) => ["dish", id] as ["dish", number]),
  ];
}

const INTO = { entry: entryInto, task: taskInto, event: eventInto, dish: dishInto };

/** Translate every pending item into `l`. True when nothing is left (a failed item is left for the next run). */
export async function backfillLang(l: Lang): Promise<boolean> {
  let ok = true;
  for (const [kind, id] of pendingFor(l)) {
    try {
      if (!(await INTO[kind](id, l))) ok = false;
    } catch (e) {
      ok = false;
      console.error(`backfill ${kind} ${id} into ${l} failed`, (e as Error).message);
    }
  }
  return ok;
}

let running: Promise<void> | null = null;
let again = false;

/** Start (or queue) the back-fill for every household language not yet done. Never throws; safe to call often. */
export function kickBackfill(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const langs = syncHouseholdLangs();
      if (!langs.length || !aiConfigured()) break; // without AI everything keeps its original language; a later kick resumes
      for (const l of langs) {
        if (await backfillLang(l)) run("UPDATE household_langs SET backfilled_at = ? WHERE lang = ?", now(), l);
      }
    } while (again);
  })()
    .catch((e) => console.error("backfill failed", (e as Error).message))
    .finally(() => (running = null));
  return running;
}

let resumed = false;
/** Once per server start: pick up a back-fill a restart interrupted. */
export function resumeBackfillOnce() {
  if (resumed) return;
  resumed = true;
  void kickBackfill();
}

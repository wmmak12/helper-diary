import { all, now, one, parseJson, run } from "./db";
import { ApiError, today } from "./api";
import { aiConfigured, translateAll, translateFields } from "./ai";
import type { User } from "./auth";
import { photoExists } from "./photos";
import { isLang, type Lang, type Texts } from "../languages";
import type { Dish } from "../types";

// 5.0 Kitchen: the household's dish book. Saving never waits for the model: names, notes and recipes are
// translated in the background (and retried when the book is next opened), so a dish saves even when
// translation cannot be reached.

type R = Record<string, unknown>;
const asLang = (v: unknown): Lang => (isLang(v) ? v : "en");

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86_400_000);
}

const SELECT = `SELECT d.*, u.name AS added_by_name, (SELECT MAX(c.date) FROM dish_cooked c WHERE c.dish_id = d.id) AS last_cooked
  FROM dishes d LEFT JOIN users u ON u.id = d.created_by`;

function toDish(r: R, viewer: User): Dish {
  const last = (r.last_cooked as string) ?? null;
  const day = today();
  return {
    id: r.id as number,
    name: r.name as string,
    lang: asLang(r.lang),
    tr: parseJson<Texts | null>(r.tr, null),
    photo: (r.photo_id as string) ?? null,
    favourite: !!r.favourite,
    note: (r.note as string) ?? "",
    note_lang: asLang(r.note_lang),
    note_tr: parseJson<Texts | null>(r.note_tr, null),
    ingredients: (r.ingredients as string) ?? "",
    steps: (r.steps as string) ?? "",
    recipe_lang: asLang(r.recipe_lang),
    recipe_tr: parseJson<Dish["recipe_tr"]>(r.recipe_tr, null),
    last_cooked: last,
    days_since: last ? Math.max(0, daysBetween(last, day)) : null,
    cooked_today: last === day,
    added_by: (r.created_by as number) ?? 0,
    added_by_name: (r.added_by_name as string) ?? "",
    can_edit: viewer.role === "employer" || viewer.id === r.created_by,
    created_at: r.created_at as number,
    updated_at: r.updated_at as number,
  };
}

/** Every dish, newest first. Opening the book also retries translations that failed earlier. */
export function listDishes(viewer: User): Dish[] {
  fillDishTranslations();
  return all<R>(`${SELECT} ORDER BY d.created_at DESC, d.id DESC`).map((r) => toDish(r, viewer));
}

export function dishFor(viewer: User, id: number): Dish {
  const r = one<R>(`${SELECT} WHERE d.id = ?`, id);
  if (!r) throw new ApiError(404, "not_found");
  return toDish(r, viewer);
}

function cleanName(v: unknown): string {
  const name = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (!name) throw new ApiError(400, "name_required");
  return name;
}

function cleanPhoto(v: unknown): string {
  if (!photoExists(v)) throw new ApiError(400, "photo_required");
  return v;
}

/** Add a dish: a photo and a name, nothing else. The name is translated afterwards. */
export function createDish(user: User, input: { name: unknown; photo: unknown; lang: unknown }): Dish {
  const name = cleanName(input.name);
  const photo = cleanPhoto(input.photo);
  const lang = isLang(input.lang) ? input.lang : (user.lang ?? "en");
  const t = now();
  const { id } = run("INSERT INTO dishes (name, lang, photo_id, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)", name, lang, photo, user.id, t, t);
  translateDishSoon(id);
  return dishFor(user, id);
}

export type DishPatch = {
  name?: unknown;
  photo?: unknown;
  lang?: unknown;
  favourite?: unknown;
  note?: unknown;
  ingredients?: unknown;
  steps?: unknown;
};

/**
 * Change a dish. Who may change what: the name and photo, whoever added it or an employer; the Favourite
 * star and the note, employers; the recipe, anyone. Text is kept in the writer's language and re-translated.
 */
export function saveDish(user: User, id: number, input: DishPatch): Dish {
  const r = one<R>("SELECT * FROM dishes WHERE id = ?", id);
  if (!r) throw new ApiError(404, "not_found");
  const lang = isLang(input.lang) ? input.lang : (user.lang ?? "en");
  const employer = user.role === "employer";
  const owner = employer || r.created_by === user.id;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(v);
  };
  if (input.name !== undefined || input.photo !== undefined) {
    if (!owner) throw new ApiError(403, "not_yours");
    if (input.name !== undefined) {
      const name = cleanName(input.name);
      if (name !== r.name) {
        set("name", name);
        set("lang", lang);
        set("tr", null);
      }
    }
    if (input.photo !== undefined) set("photo_id", cleanPhoto(input.photo));
  }
  if (input.favourite !== undefined || input.note !== undefined) {
    if (!employer) throw new ApiError(403, "employer_only");
    if (input.favourite !== undefined) set("favourite", input.favourite ? 1 : 0);
    if (input.note !== undefined) {
      const note = typeof input.note === "string" ? input.note.trim().slice(0, 600) : "";
      if (note !== r.note) {
        set("note", note);
        set("note_lang", lang);
        set("note_tr", null);
      }
    }
  }
  if (input.ingredients !== undefined || input.steps !== undefined) {
    const ingredients = input.ingredients !== undefined ? (typeof input.ingredients === "string" ? input.ingredients.trim().slice(0, 4000) : "") : (r.ingredients as string);
    const steps = input.steps !== undefined ? (typeof input.steps === "string" ? input.steps.trim().slice(0, 8000) : "") : (r.steps as string);
    if (ingredients !== r.ingredients || steps !== r.steps) {
      set("ingredients", ingredients);
      set("steps", steps);
      set("recipe_lang", lang);
      set("recipe_tr", null);
    }
  }
  if (sets.length) {
    set("updated_at", now());
    run(`UPDATE dishes SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
    translateDishSoon(id);
  }
  return dishFor(user, id);
}

export function deleteDish(user: User, id: number) {
  const r = one<R>("SELECT created_by FROM dishes WHERE id = ?", id);
  if (!r) throw new ApiError(404, "not_found");
  if (user.role !== "employer" && r.created_by !== user.id) throw new ApiError(403, "not_yours");
  run("DELETE FROM dishes WHERE id = ?", id);
}

/** The helper cooked it today. Once a day: a second tap changes nothing. */
export function cookedToday(user: User, id: number): Dish {
  if (user.role !== "helper") throw new ApiError(403, "helper_only");
  if (!one("SELECT id FROM dishes WHERE id = ?", id)) throw new ApiError(404, "not_found");
  run("INSERT OR IGNORE INTO dish_cooked (dish_id, date, user_id, at) VALUES (?,?,?,?)", id, today(), user.id, now());
  return dishFor(user, id);
}

// ---------------------------------------------------------------- translation (background)

/** Translate whatever of one dish is still untranslated. Each write checks the text is still the one translated. */
export async function translateDish(id: number): Promise<boolean> {
  const r = one<R>("SELECT * FROM dishes WHERE id = ?", id);
  if (!r) return true;
  let ok = true;
  try {
    if (!r.tr) {
      const tr = await translateAll(r.name as string, asLang(r.lang));
      run("UPDATE dishes SET tr = ? WHERE id = ? AND name = ? AND lang = ?", JSON.stringify(tr), id, r.name, r.lang);
    }
  } catch (e) {
    ok = false;
    console.error("translate dish name failed", (e as Error).message);
  }
  try {
    if ((r.note as string) && !r.note_tr) {
      const tr = await translateAll(r.note as string, asLang(r.note_lang));
      run("UPDATE dishes SET note_tr = ? WHERE id = ? AND note = ?", JSON.stringify(tr), id, r.note);
    }
  } catch (e) {
    ok = false;
    console.error("translate dish note failed", (e as Error).message);
  }
  try {
    if (((r.ingredients as string) || (r.steps as string)) && !r.recipe_tr) {
      const t = await translateFields({ ingredients: r.ingredients as string, steps: r.steps as string }, asLang(r.recipe_lang));
      run("UPDATE dishes SET recipe_tr = ? WHERE id = ? AND ingredients = ? AND steps = ?", JSON.stringify({ ingredients: t.ingredients, steps: t.steps }), id, r.ingredients, r.steps);
    }
  } catch (e) {
    ok = false;
    console.error("translate dish recipe failed", (e as Error).message);
  }
  return ok;
}

function translateDishSoon(id: number) {
  if (aiConfigured()) void translateDish(id).catch(() => {});
}

const UNTRANSLATED = `SELECT id FROM dishes WHERE tr IS NULL OR (note <> '' AND note_tr IS NULL)
  OR ((ingredients <> '' OR steps <> '') AND recipe_tr IS NULL) ORDER BY id LIMIT 3`;
let filling = false;
let lastFill = 0;
/** Retry a few untranslated dishes; at most every 20 s so an unreachable model is not asked on every load. */
export function fillDishTranslations() {
  if (filling || Date.now() - lastFill < 20_000 || !aiConfigured()) return;
  filling = true;
  lastFill = Date.now();
  (async () => {
    for (const r of all<{ id: number }>(UNTRANSLATED)) if (!(await translateDish(r.id))) break;
  })()
    .catch(() => {})
    .finally(() => (filling = false));
}

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

// One SQLite file under DATA_DIR. Every table is household-wide (one family per install) and every
// request is checked against the signed-in user in lib/server/auth.ts before it reaches these rows.

export function dataDir(): string {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employer','helper')),
  is_admin INTEGER NOT NULL DEFAULT 0,
  lang TEXT,
  created_at INTEGER NOT NULL,
  removed_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  role TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  used_by INTEGER REFERENCES users(id),
  used_at INTEGER,
  revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS password_resets (
  code_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS rate (
  key TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_key ON rate(key, at);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  uploader INTEGER NOT NULL REFERENCES users(id),
  mime TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS hold_records (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  page TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS hold_records_at ON hold_records(created_at);
CREATE TABLE IF NOT EXISTS talks (
  id INTEGER PRIMARY KEY,
  lang TEXT NOT NULL,
  title TEXT,
  title_tr TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  drafted_at INTEGER,
  drafting INTEGER NOT NULL DEFAULT 0,
  draft_error TEXT
);
CREATE TABLE IF NOT EXISTS talk_lines (
  id INTEGER PRIMARY KEY,
  talk_id INTEGER NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL CHECK (speaker IN ('employer','helper')),
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','photo')),
  text TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL,
  tr TEXT,
  photo_id TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL,
  edited_at INTEGER
);
CREATE INDEX IF NOT EXISTS talk_lines_talk ON talk_lines(talk_id, id);
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY,
  section TEXT NOT NULL CHECK (section IN ('purpose','rules','instructions','details')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL,
  tr TEXT,
  photos TEXT NOT NULL DEFAULT '[]',
  steps TEXT,
  phone TEXT,
  emergency INTEGER NOT NULL DEFAULT 0,
  pos REAL NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  source_talk_id INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  removed_at INTEGER
);
CREATE TABLE IF NOT EXISTS entry_reads (
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  seen_version INTEGER NOT NULL DEFAULT 0,
  understood_version INTEGER NOT NULL DEFAULT 0,
  understood_at INTEGER,
  PRIMARY KEY (entry_id, user_id)
);
CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY,
  talk_id INTEGER NOT NULL REFERENCES talks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('keypoint','instruction','guide')),
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL,
  steps TEXT,
  match TEXT NOT NULL DEFAULT 'new' CHECK (match IN ('new','merge','replace')),
  target_entry_id INTEGER,
  merged_body TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','approved','dropped')),
  entry_id INTEGER,
  task_id INTEGER,
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by INTEGER
);
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  collection_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL,
  tr TEXT,
  photos TEXT NOT NULL DEFAULT '[]',
  shared INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL,
  tr TEXT,
  time TEXT,
  photo_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('routine','once')),
  weekdays TEXT,
  date TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  removed_at INTEGER
);
CREATE TABLE IF NOT EXISTS task_done (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  at INTEGER NOT NULL,
  PRIMARY KEY (task_id, date)
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  asker_id INTEGER NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  lang TEXT NOT NULL,
  tr TEXT,
  ref_type TEXT CHECK (ref_type IN ('entry','task') OR ref_type IS NULL),
  ref_id INTEGER,
  answer TEXT,
  answer_lang TEXT,
  answer_tr TEXT,
  answered_by INTEGER REFERENCES users(id),
  answered_at INTEGER,
  answer_seen_at INTEGER,
  created_at INTEGER NOT NULL
);
`;

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const file = path.join(dataDir(), "household.sqlite");
  db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Additive columns for databases created by earlier releases. Existing rows keep their values. */
function migrate(d: DatabaseSync) {
  const has = (table: string, col: string) =>
    (d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col);
  // 1.2: critical points from a talk saved straight into the Notebook
  if (!has("entries", "auto_talk_id")) d.exec("ALTER TABLE entries ADD COLUMN auto_talk_id INTEGER");
  if (!has("drafts", "auto")) d.exec("ALTER TABLE drafts ADD COLUMN auto INTEGER NOT NULL DEFAULT 0");
  // 2.0: calendar. Routines get how they repeat and the first date they show; old routines keep their weekdays
  // (none = daily) and start on the day they were made, so past days before them stay empty.
  if (!has("tasks", "repeat")) {
    d.exec("ALTER TABLE tasks ADD COLUMN repeat TEXT");
    d.exec("ALTER TABLE tasks ADD COLUMN start_date TEXT");
    const tz = process.env.HOUSEHOLD_TZ || "Asia/Singapore";
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    const rows = d.prepare("SELECT id, weekdays, created_at FROM tasks WHERE kind = 'routine'").all() as { id: number; weekdays: string | null; created_at: number }[];
    const upd = d.prepare("UPDATE tasks SET repeat = ?, start_date = ? WHERE id = ?");
    for (const r of rows) {
      let days: unknown = [];
      try {
        days = JSON.parse(r.weekdays || "[]");
      } catch {}
      const weekly = Array.isArray(days) && days.length > 0 && days.length < 7;
      upd.run(weekly ? "weekly" : "daily", day.format(new Date(r.created_at)), r.id);
    }
  }
  d.exec(`CREATE TABLE IF NOT EXISTS task_moves (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    from_date TEXT NOT NULL,
    to_date TEXT NOT NULL,
    PRIMARY KEY (task_id, from_date)
  );
  CREATE TABLE IF NOT EXISTS cal_items (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('event','dayoff')),
    date TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL,
    tr TEXT,
    time TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS cal_items_date ON cal_items(date);`);
  // 3.0: task templates. A household's own templates, each time one is put on the calendar, and which tasks that
  // added. Removing an application ends its routines (end_date) so past days and their ticks stay as they were.
  d.exec(`CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    lang TEXT NOT NULL,
    tasks TEXT NOT NULL DEFAULT '[]',
    created_by INTEGER REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS template_applications (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at INTEGER NOT NULL,
    removed_at INTEGER
  );`);
  if (!has("tasks", "application_id")) d.exec("ALTER TABLE tasks ADD COLUMN application_id INTEGER");
  if (!has("tasks", "end_date")) d.exec("ALTER TABLE tasks ADD COLUMN end_date TEXT");
  // 4.0: a repeating task applied from a template skips the first-week days that already had it
  if (!has("tasks", "skip_dates")) d.exec("ALTER TABLE tasks ADD COLUMN skip_dates TEXT");
  // 4.0: AI template helper. One household profile (shared by the employers), chats with their messages and the
  // chat's last proposal (a working copy of a template, never on the calendar).
  d.exec(`CREATE TABLE IF NOT EXISTS household_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id),
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tpl_chats (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL,
    base_ref TEXT,
    base_name TEXT,
    base_tasks TEXT,
    proposal TEXT,
    proposal_base TEXT,
    proposal_state TEXT,
    accepted_ref TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tpl_chat_messages (
    id INTEGER PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES tpl_chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user','ai')),
    kind TEXT NOT NULL DEFAULT 'text',
    text TEXT NOT NULL,
    lang TEXT NOT NULL,
    proposal TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS tpl_chat_messages_chat ON tpl_chat_messages(chat_id, id);`);
  // 5.2: an AI reply can offer household details the employer mentioned (Save to Your household); saved once
  if (!has("tpl_chat_messages", "facts")) d.exec("ALTER TABLE tpl_chat_messages ADD COLUMN facts TEXT");
  if (!has("tpl_chat_messages", "facts_saved")) d.exec("ALTER TABLE tpl_chat_messages ADD COLUMN facts_saved INTEGER NOT NULL DEFAULT 0");
  // 5.0: Kitchen, the household's dish book. A dish is a photo and a name (translated); the recipe, an employer's
  // favourite and note, and the days the helper cooked it are all optional and added later.
  d.exec(`CREATE TABLE IF NOT EXISTS dishes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    lang TEXT NOT NULL,
    tr TEXT,
    photo_id TEXT,
    favourite INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    note_lang TEXT,
    note_tr TEXT,
    ingredients TEXT NOT NULL DEFAULT '',
    steps TEXT NOT NULL DEFAULT '',
    recipe_lang TEXT,
    recipe_tr TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dish_cooked (
    dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id),
    at INTEGER NOT NULL,
    PRIMARY KEY (dish_id, date)
  );`);
  // 5.3: the owner's AI and speech settings (one row per part, 'text' or 'speech'). The key is read on the server only
  // and never sent back; GET/PUT /api/ai-settings (owner only) return just its hint.
  d.exec(`CREATE TABLE IF NOT EXISTS ai_settings (
    part TEXT PRIMARY KEY CHECK (part IN ('text','speech')),
    base_url TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    api_key TEXT NOT NULL DEFAULT '',
    updated_by INTEGER REFERENCES users(id),
    updated_at INTEGER NOT NULL
  );
  -- 5.3: the household's languages and whether earlier Notebook entries, tasks and dishes have been translated into
  -- each (backfilled_at NULL = still to do; a restart picks it up again, item by item).
  CREATE TABLE IF NOT EXISTS household_langs (
    lang TEXT PRIMARY KEY,
    added_at INTEGER NOT NULL,
    backfilled_at INTEGER
  );`);
}

export function now(): number {
  return Date.now();
}

export function tx<T>(fn: () => T): T {
  const d = getDb();
  d.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

type Row = Record<string, unknown>;
export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params as never[])) as T[];
}
export function one<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...(params as never[])) as T | undefined;
}
export function run(sql: string, ...params: unknown[]): { id: number; changes: number } {
  const r = getDb().prepare(sql).run(...(params as never[]));
  return { id: Number(r.lastInsertRowid), changes: Number(r.changes) };
}

export function parseJson<T>(s: unknown, fallback: T): T {
  if (typeof s !== "string" || !s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

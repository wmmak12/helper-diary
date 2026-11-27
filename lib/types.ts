import type { Lang, Texts } from "./languages";

// Shapes the JSON API returns. Shared by the web client and the 2.0 phone apps.

export type Me = {
  id: number;
  name: string;
  login: string;
  role: "employer" | "helper";
  is_admin: boolean;
  lang: Lang | null;
  helper_lang: Lang;
  helper_name: string | null;
  /** Text AI is available (owner's saved settings or the server's). */
  ai: boolean;
  /** The owner's speech-to-text settings are filled in; Hold to talk shows only when true (5.3). */
  speech: boolean;
};

export type Photo = string; // photo id, served at /api/photos/:id

export type Line = {
  id: number;
  talk_id: number;
  speaker: "employer" | "helper";
  kind: "text" | "photo";
  text: string;
  lang: Lang;
  tr: Texts | null;
  photo: Photo | null;
  created_at: number;
  edited_at: number | null;
};

export type TalkSummary = {
  id: number;
  lang: Lang;
  title: string | null;
  title_tr: Texts | null;
  created_at: number;
  updated_at: number;
  lines: number;
  waiting: number;
  drafting: boolean;
  first_line: Line | null;
};

export type Section = "purpose" | "rules" | "instructions" | "details";
export const SECTIONS: Section[] = ["purpose", "rules", "instructions", "details"];

export type Step = { text: string; tr: Texts | null; photo: Photo | null };

export type Entry = {
  id: number;
  section: Section;
  title: string;
  body: string;
  lang: Lang;
  title_tr: Texts | null;
  body_tr: Texts | null;
  photos: Photo[];
  steps: Step[];
  phone: string | null;
  emergency: boolean;
  pos: number;
  version: number;
  updated_at: number;
  source_talk_id: number | null;
  /** saved by itself from a talk as a critical point (no approval); the talk it came from */
  auto_from: { talk_id: number; title: string | null; title_tr: Texts | null; lang: Lang; at: number } | null;
  /** helper confirmed the current version */
  understood_at: number | null;
  /** for the helper: this version is new to her (not opened yet) */
  is_new: boolean;
  open_questions: number;
};

export type Draft = {
  id: number;
  talk_id: number;
  kind: "keypoint" | "instruction" | "guide";
  section: Section;
  title: string;
  body: string;
  lang: Lang;
  steps: { text: string; photo: Photo | null }[];
  match: "new" | "merge" | "replace";
  target: Entry | null;
  merged_body: string | null;
  reason: string | null;
  status: "waiting" | "approved" | "dropped";
  entry_id: number | null;
  task_id: number | null;
  /** a critical point the app saved straight into the Notebook (status "approved", entry_id set) */
  auto: boolean;
};

export type TalkDetail = Omit<TalkSummary, "lines"> & { lines: Line[]; drafts: Draft[]; draft_error: string | null };

export type Collection = { id: number; name: string; count: number };

export type Note = {
  id: number;
  owner_id: number;
  owner_name: string;
  collection_id: number | null;
  collection_name: string | null;
  title: string;
  body: string;
  lang: Lang;
  title_tr: Texts | null;
  body_tr: Texts | null;
  photos: Photo[];
  shared: boolean;
  created_at: number;
  updated_at: number;
};

export type Task = {
  id: number;
  title: string;
  note: string;
  lang: Lang;
  title_tr: Texts | null;
  note_tr: Texts | null;
  time: string | null;
  photo: Photo | null;
  kind: "routine" | "once";
  /** 2.0: how a routine repeats. "none" for a one-off task. Monthly falls on start_date's day, or the month's last day. */
  repeat: Repeat;
  weekdays: number[];
  /** one-off: its date */
  date: string | null;
  /** routines: first date it shows (never before) */
  start_date: string | null;
  /** 2.0: on a dated list, this occurrence was moved here from that date */
  moved_from: string | null;
  done_at: number | null;
};

export type Repeat = "none" | "daily" | "weekly" | "monthly";

/** 2.0: a family event or the helper's day off on one date. A day off has no title. */
export type CalItem = {
  id: number;
  kind: "event" | "dayoff";
  date: string;
  title: string;
  lang: Lang;
  title_tr: Texts | null;
  time: string | null;
};

/** 2.0: one date on the calendar: its tasks (occurrences, ticks for that date) and its events / day off. */
export type CalDay = { date: string; tasks: Task[]; items: CalItem[] };

/** 2.0: a day page. Notes follow the Notes rule: private ones only to their owner. */
export type DayView = CalDay & {
  today: string;
  talks: TalkSummary[];
  entries: Entry[];
  notes: Note[];
};

export type Question = {
  id: number;
  asker_name: string;
  text: string;
  lang: Lang;
  tr: Texts | null;
  ref_type: "entry" | "task" | null;
  ref_id: number | null;
  ref_title: string | null;
  ref_title_tr: Texts | null;
  ref_lang: Lang | null;
  answer: string | null;
  answer_lang: Lang | null;
  answer_tr: Texts | null;
  answered_by_name: string | null;
  answered_at: number | null;
  answer_seen: boolean;
  created_at: number;
};

export type TodayView = {
  date: string;
  tasks: Task[];
  done: number;
  total: number;
  changed: Entry[];
  answers: Question[];
  open_questions: Question[];
};

export type Invite = {
  code: string;
  role: "employer" | "helper" | null;
  created_at: number;
  status: "unused" | "used" | "revoked";
  used_by_name: string | null;
};

/** PUT /api/me/password (5.4): the current password and the new one (8 to 200 characters). */
export type PasswordChange = { current: string; password: string };

/** POST /api/members/[id]/reset (5.5, owner only): a one-time code that sets that member's password, valid until expires_at. */
export type PasswordResetMade = { code: string; expires_at: number };
/** GET /api/reset?code= (5.5, public): whose password the code sets. POST /api/reset { code, password } then signs them in. */
export type PasswordResetFor = { name: string; login: string; lang: Lang | null };

export type Member = { id: number; name: string; login: string; role: "employer" | "helper"; is_admin: boolean; lang: Lang | null };

export type SearchHit = {
  type: "entry" | "note" | "talk" | "task" | "question";
  id: number;
  href: string;
  title: string;
  title_tr: Texts | null;
  snippet: string;
  snippet_tr: Texts | null;
  lang: Lang;
};

// ---- Silent hold records (1.4). The phone sends one per hold, per New talk and per load of Talk to POST /api/holds.
// They are written to the server log and kept for the household; no screen, role or public route reads them back
// (the team reads them with scripts/hold-records.mjs, see docs/testing.md). They never contain audio.

/** One thing a recogniser reported (or Talk did to it), with ms since the press. `rec` counts recognisers within the hold. */
export type HoldEvent = {
  t: number;
  rec: number;
  /** 1.9: call:getUserMedia, micOpen, listening (message = recording type), recorded (n = bytes), heard (text), error.
   *  Records before 1.9 hold the phone recogniser's events (start, audiostart, result, end…; warm, deafRetry…). */
  type: string;
  text?: string;
  final?: boolean;
  n?: number;
  error?: string;
  message?: string;
};

export type HoldOutcome = "sent" | "heardNothing" | "tooShort" | "cancelled" | "problem" | "noRecogniser";

export type HoldRecordInput =
  | {
      kind: "hold";
      /** random id of this page load: records with the same page came from one load of the app */
      page: string;
      /** this phone's clock, ms since epoch */
      pressAt: number;
      releaseAt: number | null;
      /** the English / 中文 switch */
      lang: string;
      talkId: number | null;
      events: HoldEvent[];
      outcome: HoldOutcome;
      problem?: string | null;
      /** ms the press waited for the previous recogniser to end, null when it did not wait */
      waitedForPrevious: number | null;
      /** ms from press until the phone was really listening, null when it never was */
      listeningAfter: number | null;
      /** 1.5: which way the hold went: words heard, a recognition ran and heard nothing, or none started */
      went?: "heard" | "deaf" | "none";
      /** 1.5: each recognition in the hold: ms from start() to the phone's start event, warm (under 150ms), heard words */
      starts?: { rec: number; after: number | null; warm: boolean | null; heard: boolean }[];
      ua: string;
    }
  | { kind: "pageLoad"; page: string; at: number; talkId: number | null; ua: string; lang?: string };

// ---------------------------------------------------------------- 3.0 task templates

/** How a template task repeats once applied. "once" lands on day 1–7 of the first week from the start date. */
export type TemplateRepeat = "daily" | "weekly" | "monthly" | "once";

export type TemplateTask = {
  title: string;
  note: string;
  /** "HH:MM" or null */
  time: string | null;
  repeat: TemplateRepeat;
  /** weekly: 0 = Sunday … 6 = Saturday */
  weekdays: number[];
  /** once: day 1–7 of the first week */
  day: number | null;
};

/** One time a template was put on the calendar; its tasks can come off together. */
export type TemplateApplication = { id: number; start_date: string; count: number; by: string };

/** "sample:<key>" for a sample, "mine:<id>" for one the household saved. */
export type TemplateRef = string;

export type Template = {
  ref: TemplateRef;
  /** draft (4.0): a chat's proposal opened by Keep editing, ref "chat:<id>" */
  kind: "sample" | "mine" | "draft";
  name: string;
  description: string;
  lang: import("./languages").Lang;
  tasks: TemplateTask[];
  /** mine: who saved it */
  saved_by: string | null;
  updated_at: number | null;
  /** applications still on the calendar, newest first */
  on_calendar: TemplateApplication[];
  /** draft: the own template ("mine:<id>") the chat was changing, if any */
  draft_of?: TemplateRef | null;
};

export type TemplatesView = { today: string; samples: Template[]; mine: Template[] };

/** The first week from the start date: which template tasks land on which day. */
export type TemplatePreview = {
  start: string;
  days: { date: string; tasks: { index: number; title: string; time: string | null; already: boolean }[] }[];
  /** tasks that will be added (those not already on the calendar) */
  adding: number;
};

// ---------------------------------------------------------------- 4.0 AI template helper (employers only)

/** One person at home; both fields optional (a name like "Grandma", an age in years). */
export type HouseholdMember = { name: string; age: number | null };

/** The household profile both employers share; every proposal is written from it. */
export type HouseholdProfile = {
  members: HouseholdMember[];
  /** "cat", "dog called Max" */
  pets: string[];
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  garden: boolean | null;
  /** what matters most, free text */
  matters: string;
  updated_at: number | null;
  updated_by: string | null;
};

/** A proposed task; `from` is the index of the task it came from in the template or proposal it changes. */
export type ProposalTask = TemplateTask & { from: number | null };

/** How one proposed task differs from what it changes: added, changed (which parts, and what it was) or the same. */
export type TaskMark = { mark: "added" | "changed" | "same"; changed: ("title" | "time" | "days" | "note")[]; was: TemplateTask | null };

/** A chat's last proposal: a working copy of a template, never on the calendar. */
export type Proposal = {
  name: string;
  lang: import("./languages").Lang;
  tasks: ProposalTask[];
  /** null for a fresh proposal (nothing it changes); one per task otherwise */
  marks: TaskMark[] | null;
  /** tasks of what it changes that the proposal leaves out */
  removed: TemplateTask[];
  state: "open" | "accepted" | "discarded";
};

export type ChatMessage = {
  id: number;
  role: "user" | "ai";
  /** ai: question (one follow-up), proposal, offtopic (what it can help with) or text */
  kind: "text" | "question" | "proposal" | "offtopic";
  text: string;
  lang: import("./languages").Lang;
  /** proposal messages: the template name and task count it proposed then */
  proposed: { name: string; count: number } | null;
  /** 5.2: household details the employer mentioned that Your household lacked (ai messages); null when none are new */
  offer: HouseholdOffer | null;
  by: string | null;
  created_at: number;
};

/** 5.2: what a Save to Your household button adds; only fields the profile did not hold. */
export type HouseholdFacts = {
  members: HouseholdMember[];
  pets: string[];
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  garden: boolean | null;
};
export type HouseholdOffer = { facts: HouseholdFacts; saved: boolean };

export type TplChatSummary = {
  id: number;
  title: string;
  lang: import("./languages").Lang;
  /** the template it was asked to change */
  base_ref: TemplateRef | null;
  base_name: string | null;
  state: Proposal["state"] | null;
  accepted_ref: TemplateRef | null;
  by: string | null;
  updated_at: number;
};

export type TplChatView = { chat: TplChatSummary; messages: ChatMessage[]; proposal: Proposal | null; profile: HouseholdProfile };

// ---------------------------------------------------------------- 5.0 Kitchen (the dish book)

/** One dish in the household's book. Only the photo and the name are given when it is added; the rest comes later. */
export type Dish = {
  id: number;
  name: string;
  lang: Lang;
  /** the name in every household language; null until translated */
  tr: Texts | null;
  /** photo id (GET /api/photos/<id>, household only) */
  photo: string | null;
  favourite: boolean;
  /** an employer's note ("less salt"), shown to everyone */
  note: string;
  note_lang: Lang;
  note_tr: Texts | null;
  ingredients: string;
  steps: string;
  recipe_lang: Lang;
  recipe_tr: { ingredients?: Texts; steps?: Texts } | null;
  /** yyyy-mm-dd of the last Cooked today, or null when never */
  last_cooked: string | null;
  /** whole days since last_cooked (0 = today), null when never */
  days_since: number | null;
  cooked_today: boolean;
  added_by: number;
  added_by_name: string;
  /** the viewer may rename it, change its photo or delete it (who added it, or an employer) */
  can_edit: boolean;
  created_at: number;
  updated_at: number;
};

// ---- AI and speech settings (5.3). Owner only: GET /api/ai-settings → { settings: AiSettings }; PUT (AiSettingsInput)
// → AiSettingsSaved. Signed out 401; anyone else 403 { error: "admin_only" } with no settings data.
// A saved key is never returned; only key_hint (its last four characters) shows that one is saved.
export type AiPart = {
  base_url: string;
  model: string;
  /** e.g. "…a1b2" when a key is saved, else null */
  key_hint: string | null;
};
export type AiCheck = { ok: true } | { ok: false; error: "unreachable" | "key" | "model" | "other"; detail?: string };
export type AiSettings = {
  text: AiPart;
  speech: AiPart;
  /** Where text AI comes from right now */
  text_source: "owner" | "server" | "none";
};
/** PUT body: each part optional. key omitted keeps the saved key; key "" clears it. */
export type AiPartInput = { base_url: string; model: string; key?: string };
export type AiSettingsInput = { text?: AiPartInput; speech?: AiPartInput };
/** PUT response: settings are saved even when a check fails. */
export type AiSettingsSaved = { settings: AiSettings; check: { text?: AiCheck; speech?: AiCheck } };

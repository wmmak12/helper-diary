import { all, now, one, parseJson, run, tx } from "./db";
import { ApiError, today } from "./api";
import type { User } from "./auth";
import { templateChatTurn, type ChatTurnOut } from "./ai";
import { cleanTasks, getTemplate, saveMine, saveNew } from "./templates";
import type { ChatMessage, HouseholdFacts, HouseholdMember, HouseholdOffer, HouseholdProfile, Proposal, ProposalTask, TaskMark, Template, TemplateTask, TplChatSummary, TplChatView } from "../types";

// 4.0 AI template helper (employers only). A household profile, chats and each chat's last proposal live in SQLite.
// The model is called only when an employer sends a message; reopening a chat or editing its proposal reads and writes
// rows only. A proposal is a working copy: nothing here touches the calendar (only the 3.0 Preview and Put on calendar do).

type R = Record<string, unknown>;

/** Bounds so one chat cannot run up the key. */
export const MAX_MESSAGE = 1000;
const HISTORY_MESSAGES = 10;
const HISTORY_CHARS = 600;

// ---------------------------------------------------------------- household profile

const EMPTY: HouseholdProfile = { members: [], pets: [], bedrooms: null, bathrooms: null, floors: null, garden: null, matters: "", updated_at: null, updated_by: null };

export function getProfile(): HouseholdProfile {
  const r = one<R>("SELECT p.*, u.name AS by_name FROM household_profile p LEFT JOIN users u ON u.id = p.updated_by WHERE p.id = 1");
  if (!r) return { ...EMPTY };
  return { ...EMPTY, ...parseJson<Partial<HouseholdProfile>>(r.data, {}), updated_at: r.updated_at as number, updated_by: (r.by_name as string) ?? null };
}

const count = (v: unknown, max: number): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

export function saveProfile(user: User, input: R): HouseholdProfile {
  const members: HouseholdMember[] = (Array.isArray(input.members) ? input.members : [])
    .slice(0, 16)
    .map((m: R) => ({ name: typeof m?.name === "string" ? m.name.trim().slice(0, 40) : "", age: count(m?.age, 120) }))
    .filter((m) => m.name || m.age !== null);
  const pets = (Array.isArray(input.pets) ? input.pets : []).filter((p): p is string => typeof p === "string").map((p) => p.trim().slice(0, 60)).filter(Boolean).slice(0, 10);
  const data = {
    members,
    pets,
    bedrooms: count(input.bedrooms, 20),
    bathrooms: count(input.bathrooms, 20),
    floors: count(input.floors, 10),
    garden: typeof input.garden === "boolean" ? input.garden : null,
    matters: typeof input.matters === "string" ? input.matters.trim().slice(0, 1000) : "",
  };
  run(
    "INSERT INTO household_profile (id, data, updated_by, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
    JSON.stringify(data),
    user.id,
    now(),
  );
  return getProfile();
}

export function profileEmpty(p: HouseholdProfile) {
  return !p.members.length && !p.pets.length && p.bedrooms === null && p.bathrooms === null && p.floors === null && p.garden === null && !p.matters;
}

/** The profile as plain lines for the model. */
function profileText(p: HouseholdProfile): string {
  if (profileEmpty(p)) return "(none saved: rely on what the employer says)";
  const who = (m: HouseholdMember) => `${m.name || "someone"}${m.age !== null ? `, age ${m.age}` : ""}`;
  const lines = [
    `People who live here (the helper is not listed): ${p.members.length ? p.members.map(who).join("; ") : "not given"}`,
    `Pets: ${p.pets.length ? p.pets.join("; ") : "none"}`,
    `Home: ${[p.bedrooms !== null && `${p.bedrooms} bedrooms`, p.bathrooms !== null && `${p.bathrooms} bathrooms`, p.floors !== null && `${p.floors} floor(s)`, p.garden === true && "has a garden", p.garden === false && "no garden"].filter(Boolean).join(", ") || "not given"}`,
  ];
  if (p.matters) lines.push(`What matters most: ${p.matters}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------- 5.2: what the app already knows

const CONTEXT_TASKS = 30;
const CONTEXT_TITLES = 20;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Small, bounded context for every chat message: employers' display names, saved template names, the tasks on the
 * calendar from today on (title, time, how they repeat) and the titles of the Notebook's house rules. Never Notebook
 * bodies, private notes, the helper's name or old chats.
 */
export function homeContext(): string {
  const employers = all<R>("SELECT name FROM users WHERE role = 'employer' AND removed_at IS NULL ORDER BY id").map((r) => r.name as string);
  const templates = all<R>("SELECT name FROM templates ORDER BY updated_at DESC LIMIT ?", CONTEXT_TITLES).map((r) => r.name as string);
  const d = today();
  const tasks = all<R>(
    `SELECT title, time, kind, repeat, weekdays, date FROM tasks WHERE removed_at IS NULL
       AND ((kind = 'once' AND date >= ?) OR (kind = 'routine' AND (end_date IS NULL OR end_date >= ?)))
     ORDER BY kind = 'once', COALESCE(time, '99:99'), id LIMIT ?`,
    d, d, CONTEXT_TASKS,
  ).map((r) => {
    let how = "daily";
    if (r.kind === "once") how = `once on ${r.date}`;
    else if (r.repeat === "monthly") how = "monthly";
    else if (r.repeat === "weekly") {
      const days = parseJson<number[]>(r.weekdays, []).filter((x) => x >= 0 && x <= 6);
      how = days.length && days.length < 7 ? `weekly ${days.map((x) => WD[x]).join(",")}` : "daily";
    }
    return `${r.time ?? "any time"} ${(r.title as string).slice(0, 80)} (${how})`;
  });
  const rules = all<R>("SELECT title FROM entries WHERE section = 'rules' AND removed_at IS NULL ORDER BY pos, id LIMIT ?", CONTEXT_TITLES).map((r) => (r.title as string).slice(0, 80));
  const list = (xs: string[]) => (xs.length ? xs.join("; ") : "none");
  return [
    `Employers (the people you are talking to): ${list(employers)}`,
    `Saved templates: ${list(templates)}`,
    `Tasks already on the helper's calendar:${tasks.length ? "\n" + tasks.map((t) => `- ${t}`).join("\n") : " none"}`,
    `House rules in the Notebook: ${list(rules)}`,
  ].join("\n");
}

// ---------------------------------------------------------------- 5.2: Save to Your household

const EMPTY_FACTS: HouseholdFacts = { members: [], pets: [], bedrooms: null, bathrooms: null, floors: null, garden: null };
const norm = (s: string) => s.trim().toLowerCase();
const holds = (have: string[], v: string) => have.some((h) => { const a = norm(h); const b = norm(v); return !!a && !!b && (a === b || a.includes(b) || b.includes(a)); });

/** Tidy what the model said it heard into household facts (anything unusable is dropped). */
export function cleanFacts(raw: unknown): HouseholdFacts {
  const x = (raw && typeof raw === "object" ? raw : {}) as R;
  const members: HouseholdMember[] = [];
  for (const m of (Array.isArray(x.people) ? x.people : Array.isArray(x.members) ? x.members : []).slice(0, 8) as R[]) {
    const name = typeof m?.name === "string" ? m.name.trim().slice(0, 40) : "";
    if (!name || holds(members.map((y) => y.name), name)) continue;
    members.push({ name, age: count(m.age, 120) });
  }
  const pets: string[] = [];
  for (const p of (Array.isArray(x.pets) ? x.pets : []).slice(0, 8)) {
    const v = typeof p === "string" ? p.trim().slice(0, 60) : "";
    if (v && !holds(pets, v)) pets.push(v);
  }
  return {
    members,
    pets,
    bedrooms: count(x.bedrooms, 20),
    bathrooms: count(x.bathrooms, 20),
    floors: count(x.floors, 10),
    garden: typeof x.garden === "boolean" ? x.garden : null,
  };
}

/** Only what the profile does not already hold; null when nothing is new. */
export function newFacts(f: HouseholdFacts, p: HouseholdProfile): HouseholdFacts | null {
  const out: HouseholdFacts = {
    members: f.members.filter((m) => !holds(p.members.map((x) => x.name), m.name)),
    pets: f.pets.filter((x) => !holds(p.pets, x)),
    bedrooms: p.bedrooms === null ? f.bedrooms : null,
    bathrooms: p.bathrooms === null ? f.bathrooms : null,
    floors: p.floors === null ? f.floors : null,
    garden: p.garden === null ? f.garden : null,
  };
  const any = out.members.length || out.pets.length || out.bedrooms !== null || out.bathrooms !== null || out.floors !== null || out.garden !== null;
  return any ? out : null;
}

function offerOf(m: R, profile: HouseholdProfile): HouseholdOffer | null {
  if (m.role !== "ai" || !m.facts) return null;
  const facts = { ...EMPTY_FACTS, ...parseJson<Partial<HouseholdFacts>>(m.facts, {}) };
  if (m.facts_saved) return { facts, saved: true };
  const fresh = newFacts(facts, profile);
  return fresh ? { facts: fresh, saved: false } : null;
}

/** Add an AI reply's offered details to Your household without overwriting anything there; marks the offer saved. */
export function saveFacts(user: User, chatId: number, messageId: number): TplChatView {
  chatRow(chatId);
  tx(() => {
    const m = one<R>("SELECT role, facts, facts_saved FROM tpl_chat_messages WHERE id = ? AND chat_id = ?", messageId, chatId);
    if (!m || m.role !== "ai" || !m.facts) throw new ApiError(404, "not_found");
    if (m.facts_saved) return;
    const p = getProfile();
    const add = newFacts({ ...EMPTY_FACTS, ...parseJson<Partial<HouseholdFacts>>(m.facts, {}) }, p);
    if (add) {
      const data = {
        members: [...p.members, ...add.members].slice(0, 16),
        pets: [...p.pets, ...add.pets].slice(0, 16),
        bedrooms: p.bedrooms ?? add.bedrooms,
        bathrooms: p.bathrooms ?? add.bathrooms,
        floors: p.floors ?? add.floors,
        garden: p.garden ?? add.garden,
        matters: p.matters,
      };
      run(
        "INSERT INTO household_profile (id, data, updated_by, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
        JSON.stringify(data), user.id, now(),
      );
      // keep only what this tap added, so the saved button names it
      run("UPDATE tpl_chat_messages SET facts = ? WHERE id = ?", JSON.stringify(add), messageId);
    }
    run("UPDATE tpl_chat_messages SET facts_saved = 1 WHERE id = ?", messageId);
  });
  return getChat(chatId);
}

// ---------------------------------------------------------------- proposals and their marks

const daysKey = (t: TemplateTask) => `${t.repeat}|${t.repeat === "weekly" ? [...t.weekdays].sort().join(",") : ""}|${t.repeat === "once" ? t.day : ""}`;

/** Mark each proposed task against what it changes; null marks for a fresh proposal. */
export function withMarks(tasks: ProposalTask[], base: TemplateTask[] | null): Pick<Proposal, "marks" | "removed"> {
  if (!base) return { marks: null, removed: [] };
  const used = new Set<number>();
  const marks: TaskMark[] = tasks.map((t) => {
    const was = t.from !== null ? base[t.from] : undefined;
    if (!was) return { mark: "added", changed: [], was: null };
    used.add(t.from!);
    const changed: TaskMark["changed"] = [];
    if (was.title !== t.title) changed.push("title");
    if ((was.time ?? null) !== (t.time ?? null)) changed.push("time");
    if (daysKey(was) !== daysKey(t)) changed.push("days");
    if ((was.note ?? "") !== (t.note ?? "")) changed.push("note");
    return { mark: changed.length ? "changed" : "same", changed, was };
  });
  return { marks, removed: base.filter((_, i) => !used.has(i)) };
}

const TIME = /^(\d{1,2}):(\d{2})$/;

/** Tidy what the model sent into template tasks; drops what cannot be a task. */
function proposalTasks(raw: unknown, baseLen: number): ProposalTask[] {
  if (!Array.isArray(raw)) throw new Error("no tasks");
  const seen = new Set<number>();
  const out: ProposalTask[] = [];
  for (const x of raw.slice(0, 40) as R[]) {
    if (!x || typeof x.title !== "string" || !x.title.trim()) continue;
    const tm = typeof x.time === "string" ? TIME.exec(x.time.trim()) : null;
    const time = tm && Number(tm[1]) < 24 ? `${tm[1].padStart(2, "0")}:${tm[2]}` : null;
    let repeat = x.repeat === "weekly" || x.repeat === "monthly" || x.repeat === "once" ? x.repeat : "daily";
    const weekdays = Array.isArray(x.weekdays) ? x.weekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [];
    if (repeat === "weekly" && weekdays.length === 0) repeat = "daily";
    const day = Number(x.day);
    const [t] = cleanTasks([{ title: x.title, note: typeof x.note === "string" ? x.note : "", time, repeat, weekdays, day: repeat === "once" ? (Number.isInteger(day) && day >= 1 && day <= 7 ? day : 1) : null }]);
    const from = Number.isInteger(x.from) && (x.from as number) >= 0 && (x.from as number) < baseLen && !seen.has(x.from as number) ? (x.from as number) : null;
    if (from !== null) seen.add(from);
    out.push({ ...t, from });
  }
  if (out.length === 0) throw new Error("no usable tasks");
  return out.sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
}

const stripFrom = (tasks: ProposalTask[]): TemplateTask[] => tasks.map(({ from: _f, ...t }) => t);

// ---------------------------------------------------------------- chats

/** English or Chinese, from the message itself: any Chinese character means 中文. */
export function messageLang(text: string): "en" | "zh" {
  return /[㐀-鿿]/.test(text) ? "zh" : "en";
}

const CHAT_SELECT = "SELECT c.*, u.name AS by_name FROM tpl_chats c LEFT JOIN users u ON u.id = c.created_by";

function summary(r: R): TplChatSummary {
  return {
    id: r.id as number,
    title: shortTitle(r.title as string),
    lang: r.lang === "zh" ? "zh" : "en",
    base_ref: (r.base_ref as string) ?? null,
    base_name: (r.base_name as string) ?? null,
    state: (r.proposal_state as Proposal["state"]) ?? null,
    accepted_ref: (r.accepted_ref as string) ?? null,
    by: (r.by_name as string) ?? null,
    updated_at: r.updated_at as number,
  };
}

function proposalOf(r: R): Proposal | null {
  const p = parseJson<{ name: string; lang: "en" | "zh"; tasks: ProposalTask[] } | null>(r.proposal, null);
  if (!p) return null;
  return { ...p, ...withMarks(p.tasks, parseJson<TemplateTask[] | null>(r.proposal_base, null)), state: (r.proposal_state as Proposal["state"]) ?? "open" };
}

function chatRow(id: number): R {
  const r = one<R>(`${CHAT_SELECT} WHERE c.id = ?`, id);
  if (!r) throw new ApiError(404, "not_found");
  return r;
}

export function getChat(id: number): TplChatView {
  const r = chatRow(id);
  const profile = getProfile();
  const messages: ChatMessage[] = all<R>("SELECT m.*, u.name AS by_name FROM tpl_chat_messages m LEFT JOIN users u ON u.id = m.created_by WHERE m.chat_id = ? ORDER BY m.id", id).map((m) => ({
    id: m.id as number,
    role: m.role as ChatMessage["role"],
    kind: m.kind as ChatMessage["kind"],
    text: m.text as string,
    lang: m.lang === "zh" ? "zh" : "en",
    proposed: parseJson<ChatMessage["proposed"]>(m.proposal, null),
    offer: offerOf(m, profile),
    by: m.role === "user" ? ((m.by_name as string) ?? null) : null,
    created_at: m.created_at as number,
  }));
  return { chat: summary(r), messages, proposal: proposalOf(r), profile };
}

function cleanMessage(v: unknown): string {
  const text = typeof v === "string" ? v.trim() : "";
  if (!text) throw new ApiError(400, "message_required");
  if (text.length > MAX_MESSAGE) throw new ApiError(400, "message_too_long");
  return text;
}

const OFFTOPIC = {
  en: "I can help plan your helper's household routine: tell me about your home and what you need, or ask me to change a template.",
  zh: "我可以帮你安排帮佣的家务日程：说说你家的情况和需要，或者让我修改一个模板。",
};

type Turn = { kind: ChatMessage["kind"]; text: string; proposal: { name: string; lang: "en" | "zh"; tasks: ProposalTask[] } | null; base: TemplateTask[] | null; facts: HouseholdFacts | null };

/** Ask the model and check its reply. Any failure is one "could not reach the AI" (503); nothing is saved. */
async function turn(r: R | null, start: { base_name: string | null; base_tasks: TemplateTask[] | null } | null, text: string, lang: "en" | "zh"): Promise<Turn> {
  const cur = r ? proposalOf(r) : null;
  const baseTasks = r ? parseJson<TemplateTask[] | null>(r.base_tasks, null) : (start?.base_tasks ?? null);
  const baseName = r ? ((r.base_name as string) ?? "") : (start?.base_name ?? "");
  const base = cur && cur.state !== "discarded"
    ? { kind: "proposal" as const, name: cur.name, tasks: stripFrom(cur.tasks) }
    : baseTasks ? { kind: "template" as const, name: baseName, tasks: baseTasks } : null;
  const history = r
    ? all<R>("SELECT role, text, proposal FROM tpl_chat_messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?", r.id, HISTORY_MESSAGES)
        .reverse()
        .map((m) => {
          const p = parseJson<{ name: string; count: number } | null>(m.proposal, null);
          const t = (m.text as string).slice(0, HISTORY_CHARS) + (p ? ` (proposed "${p.name}", ${p.count} tasks)` : "");
          return { role: m.role as "user" | "ai", text: t };
        })
    : [];
  let out: ChatTurnOut;
  const profile = getProfile();
  try {
    out = await templateChatTurn({ lang, profile: profileText(profile), home: homeContext(), history, base, message: text });
  } catch (e) {
    console.error("template chat: model call failed", (e as Error).message);
    throw new ApiError(503, "ai_unavailable");
  }
  try {
    if (out.type === "offtopic") return { kind: "offtopic", text: OFFTOPIC[lang], proposal: null, base: null, facts: null };
    const message = typeof out.message === "string" ? out.message.trim().slice(0, 900) : "";
    // what the employer said about the home that Your household lacks (a bad shape only loses the offer)
    let facts: HouseholdFacts | null = null;
    try {
      facts = newFacts(cleanFacts(out.household), profile);
    } catch {}
    if (out.type === "question") {
      if (!message) throw new Error("empty question");
      return { kind: "question", text: message, proposal: null, base: null, facts };
    }
    if (out.type !== "proposal") throw new Error("unknown reply type");
    const tasks = proposalTasks(out.tasks, base?.tasks.length ?? 0);
    const name = (typeof out.name === "string" && out.name.trim() ? out.name.trim() : base?.name || (lang === "zh" ? "新模板" : "New routine")).slice(0, 80);
    return { kind: "proposal", text: message, proposal: { name, lang, tasks }, base: base?.tasks ?? null, facts };
  } catch (e) {
    console.error("template chat: unusable reply", (e as Error).message);
    throw new ApiError(503, "ai_unavailable");
  }
}

function save(chatId: number, user: User, text: string, lang: "en" | "zh", t: Turn) {
  const at = now();
  run("INSERT INTO tpl_chat_messages (chat_id, role, kind, text, lang, created_by, created_at) VALUES (?,?,?,?,?,?,?)", chatId, "user", "text", text, lang, user.id, at);
  run(
    "INSERT INTO tpl_chat_messages (chat_id, role, kind, text, lang, proposal, facts, created_at) VALUES (?,?,?,?,?,?,?,?)",
    chatId, "ai", t.kind, t.text, lang, t.proposal ? JSON.stringify({ name: t.proposal.name, count: t.proposal.tasks.length }) : null, t.facts ? JSON.stringify(t.facts) : null, at + 1,
  );
  if (t.proposal) run("UPDATE tpl_chats SET proposal = ?, proposal_base = ?, proposal_state = 'open', updated_at = ? WHERE id = ?", JSON.stringify(t.proposal), t.base ? JSON.stringify(t.base) : null, at, chatId);
  else run("UPDATE tpl_chats SET updated_at = ? WHERE id = ?", at, chatId);
}

const titleOf = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 200);

/** A past chat's title: up to 70 characters, cut at a word (when it has spaces) with an ellipsis. Titles stored
 * before 5.0 were cut at exactly 70 characters, so those are cut again here. */
function shortTitle(title: string): string {
  const s = title.replace(/\s+/g, " ").trim();
  if (s.length < 70) return s;
  let cut = s.slice(0, 69);
  const sp = cut.lastIndexOf(" ");
  if (sp > 30) cut = cut.slice(0, sp);
  return cut.replace(/[\s,.;:!?，。、；：！？]+$/u, "") + "…";
}

/** Start a chat with its first message, optionally about a template (its working copy as the employer left it). */
export async function startChat(user: User, input: R): Promise<TplChatView> {
  const text = cleanMessage(input.text);
  const lang = messageLang(text);
  let base: { ref: string | null; name: string | null; tasks: TemplateTask[] | null } = { ref: null, name: null, tasks: null };
  if (typeof input.base_ref === "string" && /^(sample:[a-z]+|mine:\d+)$/.test(input.base_ref)) {
    const tpl = getTemplate(input.base_ref, user.lang ?? "en");
    const tasks = input.base_tasks === undefined ? tpl.tasks : cleanTasks(input.base_tasks);
    const name = typeof input.base_name === "string" && input.base_name.trim() ? input.base_name.trim().slice(0, 80) : tpl.name;
    base = { ref: tpl.ref, name, tasks };
  }
  const t = await turn(null, { base_name: base.name, base_tasks: base.tasks }, text, lang);
  const id = tx(() => {
    const at = now();
    const { id } = run(
      "INSERT INTO tpl_chats (title, lang, base_ref, base_name, base_tasks, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
      titleOf(text), lang, base.ref, base.name, base.tasks ? JSON.stringify(base.tasks) : null, user.id, at, at,
    );
    save(id, user, text, lang, t);
    return id;
  });
  return getChat(id);
}

/** Carry on a chat: the model answers, or refines the last proposal. */
export async function sendMessage(user: User, id: number, input: R): Promise<TplChatView> {
  const text = cleanMessage(input.text);
  const lang = messageLang(text);
  const t = await turn(chatRow(id), null, text, lang);
  tx(() => save(id, user, text, lang, t));
  return getChat(id);
}

function openProposal(id: number): { r: R; p: Proposal } {
  const r = chatRow(id);
  const p = proposalOf(r);
  if (!p || p.state === "discarded") throw new ApiError(409, "no_proposal");
  return { r, p };
}

/** The employer's own edits on the card (title, time, days, remove): no model call. */
export function editProposal(id: number, input: R): TplChatView {
  const { r, p } = openProposal(id);
  if (p.state !== "open") throw new ApiError(409, "already_accepted");
  if (!Array.isArray(input.tasks)) throw new ApiError(400, "no_tasks");
  const raw = input.tasks as R[];
  const baseLen = parseJson<TemplateTask[] | null>(r.proposal_base, null)?.length ?? 0;
  const tasks = cleanTasks(raw).map((t, i) => {
    const f = raw[i]?.from;
    return { ...t, from: Number.isInteger(f) && (f as number) >= 0 && (f as number) < baseLen ? (f as number) : null };
  });
  if (tasks.length === 0) throw new ApiError(400, "no_tasks");
  run("UPDATE tpl_chats SET proposal = ?, updated_at = ? WHERE id = ?", JSON.stringify({ name: p.name, lang: p.lang, tasks }), now(), id);
  return getChat(id);
}

export function discardProposal(id: number): TplChatView {
  openProposal(id);
  run("UPDATE tpl_chats SET proposal_state = 'discarded', updated_at = ? WHERE id = ?", now(), id);
  return getChat(id);
}

const mineId = (ref: unknown) => (typeof ref === "string" && /^mine:\d+$/.test(ref) ? Number(ref.slice(5)) : null);
const mineExists = (id: number | null) => id !== null && !!one("SELECT 1 FROM templates WHERE id = ?", id);

/**
 * Save the proposal: a change to an own template (or to one this chat already saved) updates it; anything else,
 * a sample included, becomes a new My template. Tasks already on the calendar are not touched.
 */
export function acceptProposal(user: User, id: number, input: R): { template: Template } {
  const { r, p } = openProposal(id);
  const target = [mineId(r.accepted_ref), mineId(r.base_ref)].find((x) => mineExists(x)) ?? null;
  const tasks = stripFrom(p.tasks);
  const template = target !== null ? saveMine(target, { name: input.name, tasks }) : saveNew(user, { name: input.name, lang: p.lang, tasks });
  run("UPDATE tpl_chats SET proposal_state = 'accepted', accepted_ref = ?, updated_at = ? WHERE id = ?", template.ref, now(), id);
  return { template };
}

/** Keep editing: the proposal as a template in the 3.0 editor, an unsaved working copy. */
export function draftTemplate(id: number): Template {
  const r = chatRow(id);
  const p = proposalOf(r);
  if (!p || p.state === "discarded") throw new ApiError(404, "not_found");
  const of = [r.accepted_ref, r.base_ref].find((x) => mineExists(mineId(x))) as string | undefined;
  return { ref: `chat:${id}`, kind: "draft", name: p.name, description: "", lang: p.lang, tasks: stripFrom(p.tasks), saved_by: null, updated_at: r.updated_at as number, on_calendar: [], draft_of: of ?? null };
}

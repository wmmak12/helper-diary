import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { langInfo, type Lang, type Texts } from "../languages";
import { householdLangs } from "./auth";
import { textConfig } from "./aisettings";

// The text model: any OpenAI-compatible chat endpoint. The owner's saved settings (Settings, 5.3) win; otherwise the
// server's AI_BASE_URL / AI_API_KEY / AI_MODEL; otherwise there is no AI and texts keep their original language.
// Server only; keys are never logged.

export class AiUnavailable extends Error {}

function model() {
  const c = textConfig();
  if (!c) return null;
  return createOpenAICompatible({ name: "household-ai", baseURL: c.baseURL, apiKey: c.apiKey })(c.model);
}

export function aiConfigured(): boolean {
  return textConfig() !== null;
}

/** Pull the first JSON object out of a model reply (tolerates ```json fences). */
export function extractJson<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON in model reply");
  return JSON.parse(src.slice(start, end + 1)) as T;
}

async function askJson<T>(system: string, prompt: string, timeoutMs = 30000, attempts = 2, maxOutputTokens?: number): Promise<T> {
  const m = model();
  if (!m) throw new AiUnavailable("AI is not configured");
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const { text } = await generateText({
        model: m,
        system,
        prompt,
        temperature: 0.2,
        maxOutputTokens,
        abortSignal: AbortSignal.timeout(timeoutMs),
        maxRetries: 0,
      });
      return extractJson<T>(text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const HOUSE_CONTEXT =
  "You work inside a household app used by a family and their live-in domestic helper. " +
  "Keep the tone warm, plain and respectful. Use natural everyday words a helper would use, not formal or literary style. " +
  "Write Burmese in standard Unicode (never Zawgyi). Write Chinese in Simplified characters.";

/** Family members are often not native speakers, so translate what they mean, not their broken grammar word by word. */
const MEANING =
  "The writer may not be a native speaker: expect broken grammar, missing words and words mixed in from another language. " +
  "Translate what they mean, in clear plain words, so it makes sense to the reader. " +
  "Do not add, explain or leave out anything, and keep names, times and numbers exactly as given.";

/** Translate one text into the household's languages (5.3: only those its members use). The original is returned under its own code. */
export async function translateAll(text: string, from: Lang, targets: Lang[] = householdLangs()): Promise<Texts> {
  const clean = text.trim();
  const out: Texts = { [from]: clean };
  const want = [...new Set(targets)].filter((t) => t !== from);
  if (!clean || want.length === 0) return out;
  const keys = want.map((c) => `"${c}": ${langInfo(c).english}`).join(", ");
  const res = await askJson<Record<string, string>>(
    `${HOUSE_CONTEXT} You are a translator. ${MEANING} ` +
      `Reply with JSON only, with these keys: {${keys}}.`,
    `Source language: ${langInfo(from).english}\nText:\n${clean}`,
  );
  for (const c of want) {
    const v = res[c];
    if (typeof v !== "string" || !v.trim()) throw new Error(`missing ${c} translation`);
    out[c] = v.trim();
  }
  return out;
}

/** Fix words speech to text clearly misheard, using the talk's recent lines; the text comes back unchanged when in doubt. */
export async function cleanTranscript(text: string, lang: Lang, context: string[]): Promise<string> {
  const res = await askJson<{ text?: unknown }>(
    `${HOUSE_CONTEXT} You correct speech-to-text transcripts of a family member speaking to their helper. ` +
      `Using the conversation so far, fix only words that were clearly misheard (for example "chicken nice" when they talk about food is "chicken rice"). ` +
      `Do not rephrase, answer, add, remove or translate anything; if unsure, keep the words as they are. ` +
      `Reply with JSON only: {"text": "<the corrected transcript>"}.`,
    `Conversation so far, oldest first:\n${context.join("\n")}\n\nTranscript (${langInfo(lang).english}):\n${text}`,
    6000,
    1, // the line waits on this; a slow reply is skipped and the words are kept as heard
  );
  return typeof res.text === "string" && res.text.trim() ? res.text.trim() : text;
}

/** Translate several short fields of one item in a single call, into the household's languages (or `targets`). */
export async function translateFields(
  fields: Record<string, string>,
  from: Lang,
  targets: Lang[] = householdLangs(),
): Promise<Record<string, Texts>> {
  const names = Object.keys(fields).filter((k) => fields[k]?.trim());
  const result: Record<string, Texts> = {};
  for (const k of Object.keys(fields)) result[k] = { [from]: fields[k] ?? "" };
  const want = [...new Set(targets)].filter((c) => c !== from);
  if (names.length === 0 || want.length === 0) return result;
  const shape = want.map((c) => `"${c}": {${names.map((n) => `"${n}": "..."`).join(", ")}}`).join(", ");
  const res = await askJson<Record<string, Record<string, string>>>(
    `${HOUSE_CONTEXT} You are a translator. ${MEANING} Keep phone numbers and line breaks. ` +
      `Languages: ${want.map((c) => `${c} = ${langInfo(c).english}`).join("; ")}. Reply with JSON only, shaped {${shape}}.`,
    `Source language: ${langInfo(from).english}\nFields as JSON:\n${JSON.stringify(Object.fromEntries(names.map((n) => [n, fields[n]])))}`,
    45000,
  );
  for (const c of want) {
    for (const n of names) {
      const v = res[c]?.[n];
      if (typeof v !== "string") throw new Error(`missing ${c}.${n}`);
      result[n][c] = v.trim();
    }
  }
  return result;
}

export type DraftOut = {
  title: string;
  drafts: {
    kind: "keypoint" | "instruction" | "guide";
    section: "purpose" | "rules" | "instructions" | "details";
    title: string;
    body: string;
    steps?: { text: string; photo?: string | null }[];
    match: "new" | "merge" | "replace";
    target_id?: number | null;
    merged_body?: string | null;
    reason?: string | null;
    critical?: boolean;
  }[];
};

/** Turn a talk transcript into a short title and drafts, matched against the current Notebook. */
export async function draftTalk(input: {
  lang: Lang;
  transcript: string;
  notebook: { id: number; section: string; title: string; body: string }[];
  /** titles already drafted from this talk on an earlier pass (a corrected talk is drafted again) */
  already?: string[];
}): Promise<DraftOut> {
  const L = langInfo(input.lang).english;
  const system =
    `${HOUSE_CONTEXT} You turn a conversation between an employer and the helper into notes for the household Notebook. ` +
    `Write everything in ${L}. Reply with JSON only:\n` +
    `{"title": "3-6 word title of the talk", "drafts": [{"kind": "keypoint"|"instruction"|"guide", "section": "purpose"|"rules"|"instructions"|"details", ` +
    `"title": "short title", "body": "the point, instruction or guide summary in plain sentences", ` +
    `"steps": [{"text": "step", "photo": "P3 or null"}], "match": "new"|"merge"|"replace", "target_id": number|null, ` +
    `"merged_body": "for merge: the existing entry rewritten to include the new point" | null, "reason": "for merge/replace: one sentence on what differs" | null, "critical": true|false}]}\n` +
    `Rules: keypoint = something to remember (a fact, preference, detail). instruction = something she must do or not do. ` +
    `guide = a demonstration with ordered steps (a dish, a cleaning method); include steps and put photo ids (like P3) on the step they illustrate. ` +
    `section: rules for do/don't, instructions for how things are done, details for names/numbers/allergies/preferences, purpose only for her main objectives. ` +
    `Compare each draft with the existing Notebook entries. If one covers the same subject: use "replace" with its target_id when the new one contradicts it ` +
    `(e.g. a different time), or "merge" with target_id and merged_body when it adds to it. Otherwise "new". ` +
    `critical = true only for a point that must never be missed because someone could be hurt or a firm house rule broken: ` +
    `a safety matter (doors, strangers, fire, gas, water, a child alone), an allergy, a medicine or dose, or a firm house rule the employer states as a must or must-never. ` +
    `Everything else (preferences, routines, chores, recipes, names, small talk) is critical = false. When unsure, use false. ` +
    `Skip greetings and small talk. Make at most 6 drafts; return an empty list if nothing is worth keeping.`;
  const prompt =
    `Existing Notebook entries:\n${input.notebook.map((e) => `#${e.id} [${e.section}] ${e.title}: ${e.body}`).join("\n") || "(none)"}\n\n` +
    (input.already?.length ? `Already drafted from this talk earlier (do not suggest these again, even reworded):\n${input.already.map((t) => `- ${t}`).join("\n")}\n\n` : "") +
    `Transcript (E = employer, H = helper, P# = a photo taken at that point):\n${input.transcript}`;
  return askJson<DraftOut>(system, prompt, 60000);
}

// ---------------------------------------------------------------- 4.0 AI template helper

export type ChatTurnOut = {
  type?: unknown;
  message?: unknown;
  name?: unknown;
  tasks?: unknown;
  /** 5.2: household details the employer just mentioned that the profile lacks */
  household?: unknown;
};

/**
 * One turn of the template chat. The caller bounds what goes in (profile, a small home context, the last few
 * messages, the template or proposal being changed) and checks what comes back; this only asks the model.
 */
export async function templateChatTurn(input: {
  lang: "en" | "zh";
  profile: string;
  /** 5.2: employers' names, saved template names, calendar tasks, house-rule titles (lib/server/tplchat.ts homeContext) */
  home: string;
  history: { role: "user" | "ai"; text: string }[];
  /** what a proposal would change: the template the chat was opened on, or the chat's last proposal */
  base: { kind: "template" | "proposal"; name: string; tasks: { title: string; note: string; time: string | null; repeat: string; weekdays: number[]; day: number | null }[] } | null;
  message: string;
}): Promise<ChatTurnOut> {
  const L = input.lang === "zh" ? "Simplified Chinese" : "English";
  const helperWord = input.lang === "zh" ? "帮佣" : "the helper";
  const system =
    `${HOUSE_CONTEXT} You help an employer plan the weekly routine of their live-in helper as a template of tasks. ` +
    `Write everything you return (message, template name, task titles and notes) in ${L}, whatever language the profile, the home facts or earlier messages use.\n` +
    `Always call her "${helperWord}". Never give the helper a name or invent one.\n` +
    `Reply with JSON only, one of:\n` +
    `{"type": "question", "message": "one short question", "household": {...}|null}\n` +
    `{"type": "proposal", "message": "2 or 3 short sentences", "name": "template name, 2-5 words", "tasks": [{"from": number|null, "title": "concrete job", "time": "HH:MM", "repeat": "daily"|"weekly"|"monthly"|"once", "weekdays": [0-6], "day": 1-7|null, "note": "one short practical note"}], "household": {...}|null}\n` +
    `{"type": "offtopic"}\n` +
    `Rules:\n` +
    `- You already know the household profile and the home facts below (employers' names, saved templates, tasks already on the calendar, house rules). ` +
    `Never ask about anything they or the conversation already tell you. Address the employers by name only when it reads naturally.\n` +
    `- offtopic: only when the message has nothing to do with household tasks, routines, the home or the people and pets in it.\n` +
    `- question: only when you cannot fit the routine to this home because something you need is still unknown, such as who lives there ` +
    `(children and their ages, elderly people), pets, or the size of the home. Ask exactly one short question, never two. ` +
    `Do not ask about preferences you can reasonably assume. ` +
    `When the employer asks to change an existing template or proposal, change it without asking unless the request cannot be understood.\n` +
    `- proposal: otherwise. 8 to 16 tasks for a new routine. Every task is one concrete job a helper does, with a time ("Sterilise bottles", "Mop the kitchen floor", ` +
    `"Give Grandma her morning medicine"), never a vague heading like "Cleaning" or "Childcare". ` +
    `Fit the tasks to the household exactly: tasks for each person who needs care and each pet that is there; nothing for a baby, a dog, a cat, a garden, ` +
    `a car or anything else the household does not have. A child of 2 or older is not a baby (no bottles). Size cleaning to the rooms there are. ` +
    `Give extra care to what the employer says matters most. ` +
    `Do not add a task that is already on the calendar (same job, even if worded differently); plan around those times instead. ` +
    `Every task must respect the house rules. ` +
    `The proposal message is 2 or 3 short sentences (about 60 words at most): what you understood about this home, and what you built the routine around (people, times, rules, what you left to the calendar). ` +
    `For a change, say in 1 or 2 sentences what you changed.\n` +
    `- repeat: daily = every day; weekly = only on the weekdays listed (0 = Sunday, 1 = Monday ... 6 = Saturday); monthly = once a month; ` +
    `once = one day of the first week, day 1-7. weekdays only for weekly; day only for once.\n` +
    `- from: when changing a template or proposal, the # number of the task this one keeps or changes; null for a new task. Leave out tasks to remove them. ` +
    `Keep every task the employer did not ask to change exactly as it was (same title, time, days and note, same from). ` +
    `When changing, keep the template's name unless asked.\n` +
    `- household: only facts about the home that the employer states in the NEW message and the household profile does not already hold: ` +
    `{"people": [{"name": "who, e.g. Wife or Grandpa, in the employer's words", "age": number|null}], "pets": ["e.g. cat"], "bedrooms": n|null, "bathrooms": n|null, "floors": n|null, "garden": true|false|null}. ` +
    `Never include the helper. Use null when there is nothing new.\n`;
  const base = input.base
    ? `${input.base.kind === "template" ? "Template the employer wants to change" : "Your last proposal, which the employer is refining"}: "${input.base.name}"\n` +
      input.base.tasks.map((t, i) => `#${i} ${JSON.stringify(t)}`).join("\n")
    : "(no template yet)";
  const prompt =
    `Household profile:\n${input.profile}\n\n` +
    `Home facts:\n${input.home}\n\n` +
    `Conversation so far, oldest first:\n${input.history.map((h) => `${h.role === "user" ? "Employer" : "You"}: ${h.text}`).join("\n") || "(none)"}\n\n` +
    `${base}\n\n` +
    `Employer's new message:\n${input.message}`;
  return askJson<ChatTurnOut>(system, prompt, 60000, 2, 4000);
}

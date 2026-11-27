import { now, one, run } from "./db";
import type { AiCheck, AiPart, AiPartInput, AiSettings } from "../types";

// 5.3: where the AI comes from. The household owner (the admin account) saves a text part (any OpenAI-compatible
// chat endpoint) and a speech part (OpenAI-style audio transcription, or DeepSeek's ASR) in Settings; they are stored
// under DATA_DIR.
// Text falls back to the server's AI_BASE_URL / AI_API_KEY / AI_MODEL; speech has no fallback.
// Keys are read here on the server only: never logged, never returned (only a hint of the last characters).

export type Part = "text" | "speech";
export type AiConfig = { baseURL: string; apiKey: string; model: string };

type Row = { base_url: string; model: string; api_key: string };

function saved(part: Part): Row {
  return one<Row>("SELECT base_url, model, api_key FROM ai_settings WHERE part = ?", part) ?? { base_url: "", model: "", api_key: "" };
}

const complete = (r: Row) => !!(r.base_url.trim() && r.model.trim() && r.api_key);
const asConfig = (r: Row): AiConfig => ({ baseURL: r.base_url.trim(), apiKey: r.api_key, model: r.model.trim() });

function serverText(): AiConfig | null {
  const baseURL = process.env.AI_BASE_URL?.trim();
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL?.trim();
  return baseURL && apiKey && model ? { baseURL, apiKey, model } : null;
}

/** Text AI: the owner's saved settings when all three are filled, else the server's, else none. */
export function textConfig(): AiConfig | null {
  const r = saved("text");
  return complete(r) ? asConfig(r) : serverText();
}

export function textSource(): AiSettings["text_source"] {
  return complete(saved("text")) ? "owner" : serverText() ? "server" : "none";
}

/** Speech to text: only the owner's saved settings. */
export function speechConfig(): AiConfig | null {
  const r = saved("speech");
  return complete(r) ? asConfig(r) : null;
}

/** Shows that a key is saved without giving it away: the last four characters, only for a key long enough to keep the rest secret. */
export function keyHint(key: string): string | null {
  if (!key) return null;
  return key.length >= 12 ? `…${key.slice(-4)}` : "…";
}

function publicPart(part: Part): AiPart {
  const r = saved(part);
  return { base_url: r.base_url, model: r.model, key_hint: keyHint(r.api_key) };
}

export function aiSettings(): AiSettings {
  return { text: publicPart("text"), speech: publicPart("speech"), text_source: textSource() };
}

/** Keep only well-formed input: strings, bounded. Returns null when the part was not sent. */
export function cleanPart(v: unknown): AiPartInput | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const s = (x: unknown, max: number) => (typeof x === "string" ? x.trim().slice(0, max) : "");
  const out: AiPartInput = { base_url: s(o.base_url, 500), model: s(o.model, 200) };
  if (typeof o.key === "string") out.key = o.key.trim().slice(0, 1000);
  return out;
}

/** Save one part. An omitted key keeps the saved one; "" clears it. */
export function savePart(part: Part, input: AiPartInput, userId: number) {
  const key = input.key === undefined ? saved(part).api_key : input.key;
  run(
    `INSERT INTO ai_settings (part, base_url, model, api_key, updated_by, updated_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(part) DO UPDATE SET base_url = excluded.base_url, model = excluded.model, api_key = excluded.api_key,
       updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    part,
    input.base_url,
    input.model,
    key,
    userId,
    now(),
  );
}

// ---------------------------------------------------------------- checks

/** `${base}/${path}`, keeping any path on the base (https://host/v1 + chat/completions). */
export function endpoint(baseURL: string, path: string): URL {
  const u = new URL(baseURL);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new TypeError("not a web address");
  u.pathname = `${u.pathname.replace(/\/+$/, "")}/${path}`;
  return u;
}

/** Turn a provider's answer into why it failed. The body is read only to tell a missing model apart; it is never passed on. */
export async function classify(res: Response): Promise<AiCheck> {
  if (res.ok) return { ok: true };
  const text = (await res.text().catch(() => "")).toLowerCase();
  if (res.status === 401 || res.status === 403) return { ok: false, error: "key", detail: `HTTP ${res.status}` };
  if (/model/.test(text) && /(not.?found|not.?exist|does not|unknown|invalid|no such|unsupported)/.test(text)) {
    return { ok: false, error: "model", detail: `HTTP ${res.status}` };
  }
  if (res.status === 404) return { ok: false, error: "unreachable", detail: "HTTP 404: nothing answers at this address" };
  return { ok: false, error: "other", detail: `HTTP ${res.status}` };
}

function failure(e: unknown): AiCheck {
  if (e instanceof TypeError && e.message === "not a web address") return { ok: false, error: "unreachable", detail: "not a web address" };
  if (e instanceof TypeError && /invalid url/i.test(e.message)) return { ok: false, error: "unreachable", detail: "not a web address" };
  if ((e as Error)?.name === "TimeoutError") return { ok: false, error: "unreachable", detail: "no answer in 15 s" };
  return { ok: false, error: "unreachable" };
}

function missing(c: { baseURL: string; apiKey: string; model: string }): AiCheck | null {
  if (!c.baseURL) return { ok: false, error: "unreachable", detail: "no address" };
  if (!c.apiKey) return { ok: false, error: "key", detail: "no key" };
  if (!c.model) return { ok: false, error: "model", detail: "no model" };
  return null;
}

const CHECK_MS = 15_000;

/** One tiny chat completion (a single output token). */
export async function checkText(c: AiConfig, f: typeof fetch = fetch): Promise<AiCheck> {
  const m = missing(c);
  if (m) return m;
  try {
    const res = await f(endpoint(c.baseURL, "chat/completions"), {
      method: "POST",
      headers: { authorization: `Bearer ${c.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: c.model, messages: [{ role: "user", content: "Reply with OK." }], max_tokens: 1 }),
      signal: AbortSignal.timeout(CHECK_MS),
    });
    return await classify(res);
  } catch (e) {
    return failure(e);
  }
}

/** Half a second of silence as 16 kHz mono 16-bit WAV, for the speech check. */
export function silentWav(ms = 500): Blob {
  const samples = Math.round(16 * ms);
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true);
  v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  return new Blob([buf], { type: "audio/wav" });
}

// DeepSeek's ASR is not OpenAI-style: its full address (…/v1/tools/asr) is saved, and it takes only `file`.
const DEEPSEEK_ASR = /\/tools\/asr\/?$/;

/** POST {base}/audio/transcriptions (OpenAI style: multipart file + model), or DeepSeek's …/tools/asr (file only). */
export async function transcribeWith(c: AiConfig, wav: Blob, opts: { language?: string; timeoutMs?: number } = {}, f: typeof fetch = fetch): Promise<Response> {
  const form = new FormData();
  form.append("file", wav, "hold.wav");
  const deepseek = DEEPSEEK_ASR.test(c.baseURL);
  if (!deepseek) {
    form.append("model", c.model);
    if (opts.language) form.append("language", opts.language);
  }
  const url = deepseek ? endpoint(c.baseURL.replace(DEEPSEEK_ASR, ""), "tools/asr") : endpoint(c.baseURL, "audio/transcriptions");
  return f(url, {
    method: "POST",
    headers: { authorization: `Bearer ${c.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(opts.timeoutMs ?? CHECK_MS),
  });
}

export async function checkSpeech(c: AiConfig, f: typeof fetch = fetch): Promise<AiCheck> {
  const m = missing(c);
  if (m) return m;
  try {
    return await classify(await transcribeWith(c, silentWav(), {}, f));
  } catch (e) {
    return failure(e);
  }
}

/** The part as saved, for checking (the key never leaves the server). */
export function savedConfig(part: Part): AiConfig {
  return asConfig(saved(part));
}

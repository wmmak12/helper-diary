import { all, parseJson } from "./db";
import { speechConfig, transcribeWith } from "./aisettings";
import type { Lang, Texts } from "../languages";

// Listening: the held button's recording (16 kHz mono WAV, made on the phone) is sent once on release to the owner's
// speech-to-text settings (5.3: an OpenAI-style /audio/transcriptions endpoint or DeepSeek's /tools/asr). There is no
// server fallback: without them Hold to talk is hidden and /api/listen refuses. Audio is never stored.

const CONTEXT_LINES = 5;

export class ListenFailed extends Error {}

export function listenConfigured(): boolean {
  return speechConfig() !== null;
}

/** The talk's last few text lines, oldest first, each in the speaker's language with the listener's language beside it. */
export function recentLines(talkId: number | null, lang: Lang): string[] {
  if (!talkId) return [];
  const rows = all<{ speaker: string; text: string; lang: string; tr: string | null }>(
    "SELECT speaker, text, lang, tr FROM talk_lines WHERE talk_id = ? AND kind = 'text' ORDER BY id DESC LIMIT ?",
    talkId,
    CONTEXT_LINES,
  ).reverse();
  return rows.map((r) => {
    const tr = parseJson<Texts | null>(r.tr, null)?.[lang];
    const who = r.speaker === "helper" ? "Helper" : "Family";
    return tr && r.lang !== lang ? `${who}: ${r.text} (${tr})` : `${who}: ${r.text}`;
  });
}

/** The recording to text. `language` (ISO 639-1, e.g. "en") is a hint; the provider may still detect it. */
export async function transcribe(wav: Blob, language?: string): Promise<string> {
  const c = speechConfig();
  if (!c) throw new ListenFailed("speech to text is not set up");
  const res = await transcribeWith(c, wav, { language, timeoutMs: 30000 });
  // the status only: a provider's error body can echo part of the key
  if (!res.ok) throw new ListenFailed(`speech to text answered ${res.status}`);
  const data = (await res.json().catch(() => ({}))) as { text?: unknown };
  return typeof data.text === "string" ? data.text.trim() : "";
}

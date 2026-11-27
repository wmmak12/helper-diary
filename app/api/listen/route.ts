import { ApiError, formBody, json, route } from "@/lib/server/api";
import { rateLimited } from "@/lib/server/auth";
import { cleanTranscript } from "@/lib/server/ai";
import { ListenFailed, listenConfigured, recentLines, transcribe } from "@/lib/server/listen";
import { isLang } from "@/lib/languages";

/**
 * POST /api/listen — a held-button recording (form fields: audio as 16 kHz mono WAV, lang, talkId) to text. When the talk
 * has earlier lines, words that were clearly misheard are fixed from its last few. Answers { text } ("" when nothing was
 * said). The audio is not stored. Uses only the owner's speech settings (5.3): without them it answers 503
 * listen_unavailable and Me.speech is false.
 */
export const POST = route(async (req, user) => {
  if (!listenConfigured()) throw new ApiError(503, "listen_unavailable");
  if (rateLimited(`listen:${user.id}`, 120, 60_000)) throw new ApiError(429, "too_many_attempts");
  const form = await formBody(req);
  const audio = form?.get("audio");
  const lang = form?.get("lang");
  const talkId = Number(form?.get("talkId"));
  if (!(audio instanceof File) || audio.size === 0) throw new ApiError(400, "audio_required");
  if (audio.size > 8 * 1024 * 1024) throw new ApiError(413, "too_large");
  const l = isLang(lang) ? lang : "en";
  let text: string;
  try {
    text = await transcribe(audio, isLang(lang) ? lang : undefined);
  } catch (e) {
    console.error(`[listen] ${(e as Error)?.message}`);
    if (e instanceof ListenFailed || (e as Error)?.name === "TimeoutError" || e instanceof TypeError) throw new ApiError(502, "listen_failed");
    throw e;
  }
  const context = text ? recentLines(Number.isInteger(talkId) && talkId > 0 ? talkId : null, l) : [];
  if (context.length) text = await cleanTranscript(text, l, context).catch(() => text); // a failed cleanup keeps what was heard
  return json({ text });
}, { employer: true });

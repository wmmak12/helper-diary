import { body, json, route } from "@/lib/server/api";
import { aiSettings, checkSpeech, checkText, cleanPart, savedConfig, savePart } from "@/lib/server/aisettings";
import type { AiSettingsSaved } from "@/lib/types";

// 5.3: the owner's AI and speech settings. Only the household owner (the admin account) may read or change them:
// signed out 401, anyone else 403 with no settings data. A saved key is never returned, only its hint.

const NO_STORE = { "Cache-Control": "no-store" };

/** GET /api/ai-settings → AiSettings */
export const GET = route(() => json({ settings: aiSettings() }, { headers: NO_STORE }), { admin: true });

/**
 * PUT /api/ai-settings (AiSettingsInput) → AiSettingsSaved. Each part sent is saved first, even when its check fails,
 * then checked with one small call: a one-token chat completion for text, half a second of silence for speech.
 */
export const PUT = route(async (req, user) => {
  const b = await body(req);
  const text = cleanPart(b.text);
  const speech = cleanPart(b.speech);
  if (text) savePart("text", text, user.id);
  if (speech) savePart("speech", speech, user.id);
  const [textCheck, speechCheck] = await Promise.all([
    text ? checkText(savedConfig("text")) : undefined,
    speech ? checkSpeech(savedConfig("speech")) : undefined,
  ]);
  const out: AiSettingsSaved = { settings: aiSettings(), check: {} };
  if (textCheck) out.check.text = textCheck;
  if (speechCheck) out.check.speech = speechCheck;
  return json(out, { headers: NO_STORE });
}, { admin: true });

import { ApiError, body, json, route, str } from "@/lib/server/api";
import { translateAll, AiUnavailable } from "@/lib/server/ai";
import { isLang } from "@/lib/languages";

/** Translate a draft text before it is saved (used for previews, e.g. her reply before it is added). */
export const POST = route(async (req) => {
  const b = await body(req);
  if (!isLang(b.from)) throw new ApiError(400, "lang_required");
  try {
    return json({ tr: await translateAll(str(b.text, 4000), b.from) });
  } catch (e) {
    throw new ApiError(e instanceof AiUnavailable ? 503 : 502, "translate_failed");
  }
});

import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

/** Add a spoken or typed line. It is saved before translation, so a failed translation loses nothing. */
export const POST = route<{ id: string }>(async (req, user, { id }) => {
  const b = await body(req);
  const speaker = b.speaker === "helper" ? "helper" : "employer";
  if (!isLang(b.lang)) throw new ApiError(400, "lang_required");
  const r = await hh.addLine(user, intId(id), { speaker, text: str(b.text, 4000), lang: b.lang });
  return json(r, 201);
}, { employer: true });

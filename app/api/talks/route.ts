import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

/** The household's talks, newest first. A helper gets them without draft counts. */
export const GET = route(async (_req, user) => {
  const talks = hh.listTalks(user);
  return json({ talks: user.role === "employer" ? talks : talks.map(hh.forHelper) });
});

export const POST = route(async (req, user) => {
  const b = await body(req);
  const lang = isLang(b.lang) ? b.lang : "en";
  const id = hh.createTalk(user, lang);
  return json({ talk: hh.talkDetail(id) }, 201);
}, { employer: true });

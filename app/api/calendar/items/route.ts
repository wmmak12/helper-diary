import { ApiError, body, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

/** 2.0: an employer adds a family event or the helper's day off to today or a later date. */
export const POST = route(async (req, user) => {
  const b = await body(req);
  if (b.kind !== "event" && b.kind !== "dayoff") throw new ApiError(400, "bad_kind");
  const item = await hh.createItem(user, {
    kind: b.kind,
    date: str(b.date, 10),
    title: str(b.title, 200),
    time: typeof b.time === "string" ? b.time : null,
    lang: isLang(b.lang) ? b.lang : (user.lang ?? "en"),
  });
  return json({ item }, 201);
}, { employer: true });

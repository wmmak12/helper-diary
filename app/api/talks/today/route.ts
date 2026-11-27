import { type NextRequest } from "next/server";
import { ApiError, body, json, route } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

/** The phone's own day, sent as its local midnight and the next one (ms). */
function day(start: unknown, end: unknown): [number, number] {
  const s = Number(start);
  const e = Number(end);
  if (!Number.isSafeInteger(s) || !Number.isSafeInteger(e) || s <= 0 || e <= s || e - s > 26 * 3600_000) throw new ApiError(400, "bad_day");
  return [s, e];
}

/** Today's talk on the phone's clock (5.1), or null before the day's first line. A helper gets it without drafts. */
export const GET = route(async (req: NextRequest, user) => {
  const q = req.nextUrl.searchParams;
  const talk = hh.dayTalk(...day(q.get("start"), q.get("end")), user);
  if (user.role !== "employer") return json({ talk: talk ? hh.forHelper(talk) : null, waiting: 0 });
  return json({ talk, waiting: hh.waitingDraftCount() });
});

/** The day's talk, made now if the day has none: every line of a day goes into one talk. */
export const POST = route(async (req, user) => {
  const b = await body(req);
  const lang = isLang(b.lang) ? b.lang : "en";
  return json({ talk: hh.dayTalkOrNew(user, lang, ...day(b.start, b.end)) });
}, { employer: true });

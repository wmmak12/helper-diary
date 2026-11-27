import { json, route, today } from "@/lib/server/api";
import * as hh from "@/lib/server/household";

/** 2.0: the calendar from `from` to `to` (yyyy-mm-dd, inclusive, at most 63 days): each date's tasks and events / day off. */
export const GET = route(async (req) => {
  const q = req.nextUrl.searchParams;
  return json({ today: today(), days: hh.calendarRange(q.get("from") ?? "", q.get("to") ?? "") });
});

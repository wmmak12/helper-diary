import { json, route } from "@/lib/server/api";
import * as hh from "@/lib/server/household";

/** 2.0: one date's page: tasks, events / day off, talks held, Notebook entries written and notes made that day. */
export const GET = route<{ date: string }>(async (_req, user, { date }) => json({ day: hh.dayView(user, date) }));

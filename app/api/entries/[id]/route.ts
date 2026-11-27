import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";
import { entryInput } from "@/lib/server/inputs";

export const GET = route<{ id: string }>(async (_req, user, { id }) => {
  const eid = intId(id);
  const entry = hh.entryById(eid, user);
  hh.markSeen(user, eid);
  return json({ entry, questions: hh.listQuestions().filter((q) => q.ref_type === "entry" && q.ref_id === eid) });
});

export const PATCH = route<{ id: string }>(async (req, user, { id }) => {
  const i = entryInput(await body(req));
  return json({ entry: await hh.saveEntry(user, intId(id), i) });
}, { employer: true });

export const DELETE = route<{ id: string }>(async (_req, _user, { id }) => {
  hh.removeEntry(intId(id));
  return json({ ok: true });
}, { employer: true });

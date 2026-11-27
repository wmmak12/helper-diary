import { intId, json, route } from "@/lib/server/api";
import * as hh from "@/lib/server/household";

/** A talk with its lines; drafts are only returned to employers (nothing reaches the helper until approved). */
export const GET = route<{ id: string }>(async (_req, user, { id }) => {
  const talk = hh.talkDetail(intId(id), user);
  return json({ talk: user.role === "employer" ? talk : hh.forHelper(talk) });
});

export const DELETE = route<{ id: string }>(async (_req, _user, { id }) => {
  hh.deleteTalk(intId(id));
  return json({ ok: true });
}, { employer: true });

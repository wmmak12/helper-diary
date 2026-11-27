import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

/** Ask for drafts now (the talk was finished). Drafting runs in the background. */
export const POST = route<{ id: string }>(async (_req, _user, { id }) => {
  const tid = intId(id);
  hh.talkDetail(tid);
  hh.startDrafting(tid);
  return json({ ok: true }, 202);
}, { employer: true });

import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

export const POST = route<{ id: string }>(async (_req, user, { id }) => {
  hh.markAnswerSeen(user, intId(id));
  return json({ ok: true });
});

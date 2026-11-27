import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

export const PATCH = route<{ id: string }>(async (req, user, { id }) => {
  hh.renameCollection(user, intId(id), str((await body(req)).name, 60));
  return json({ ok: true });
});
export const DELETE = route<{ id: string }>(async (_req, user, { id }) => {
  hh.deleteCollection(user, intId(id));
  return json({ ok: true });
});

import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

export const PATCH = route<{ id: string }>(async (req, _user, { id }) => {
  const b = await body(req);
  return json(await hh.editLine(intId(id), str(b.text, 4000)));
}, { employer: true });

export const DELETE = route<{ id: string }>(async (_req, _user, { id }) => {
  hh.deleteLine(intId(id));
  return json({ ok: true });
}, { employer: true });

import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";

export const POST = route<{ id: string }>(async (req, user, { id }) => {
  const b = await body(req);
  return json({ task: hh.setDone(user, intId(id), b.done !== false) });
});

import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";
import { taskInput } from "@/lib/server/inputs";

export const PATCH = route<{ id: string }>(async (req, _user, { id }) => json({ task: await hh.saveTask(intId(id), taskInput(await body(req))) }), { employer: true });

export const DELETE = route<{ id: string }>(async (_req, _user, { id }) => {
  hh.removeTask(intId(id));
  return json({ ok: true });
}, { employer: true });

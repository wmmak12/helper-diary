import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";
import { noteInput } from "@/lib/server/inputs";

export const GET = route<{ id: string }>(async (_req, user, { id }) => json({ note: hh.noteFor(user, intId(id)) }));

export const PATCH = route<{ id: string }>(async (req, user, { id }) => json({ note: await hh.saveNote(user, intId(id), noteInput(await body(req))) }));

export const DELETE = route<{ id: string }>(async (_req, user, { id }) => {
  hh.deleteNote(user, intId(id));
  return json({ ok: true });
});

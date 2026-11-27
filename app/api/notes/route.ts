import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";
import { noteInput } from "@/lib/server/inputs";

export const GET = route(async (_req, user) => json({ notes: hh.listNotes(user), collections: hh.listCollections(user) }));

export const POST = route(async (req, user) => {
  const i = noteInput(await body(req));
  return json({ note: await hh.createNote(user, { ...i, title: i.title ?? "", body: i.body ?? "", lang: i.lang ?? user.lang ?? "my" }) }, 201);
});

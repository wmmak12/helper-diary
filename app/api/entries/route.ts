import { type NextRequest } from "next/server";
import { ApiError, body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";
import { isLang } from "@/lib/languages";
import { entryInput } from "@/lib/server/inputs";

export const GET = route(async (_req, user) => {
  hh.fillMissingTranslations();
  return json({ entries: hh.listEntries(user) });
});

export const POST = route(async (req, user) => {
  const i = entryInput(await body(req));
  if (!i.lang) throw new ApiError(400, "lang_required");
  return json({ entry: await hh.createEntry(user, { ...i, title: i.title ?? "", body: i.body ?? "", lang: i.lang }) }, 201);
}, { employer: true });

import { body, json, route, today } from "@/lib/server/api";
import { isLang } from "@/lib/languages";
import * as tp from "@/lib/server/templates";
import { draftTemplate } from "@/lib/server/tplchat";

// 3.0: task templates, employers only. GET lists samples (in ?lang) and the household's own; ?ref= returns one.
export const GET = route(async (req, user) => {
  const q = req.nextUrl.searchParams;
  const l = q.get("lang");
  const lang = isLang(l) ? l : (user.lang ?? "en");
  const ref = q.get("ref");
  // 4.0: ref=chat:<id> is a chat's proposal opened in the editor (Keep editing)
  const chat = ref ? /^chat:(\d+)$/.exec(ref) : null;
  if (chat) return json({ template: draftTemplate(Number(chat[1])), today: today() });
  return json(ref ? { template: tp.getTemplate(ref, lang), today: today() } : tp.listTemplates(lang));
}, { employer: true });

/** Save as my template: { name, lang, tasks } */
export const POST = route(async (req, user) => {
  const b = await body(req);
  return json({ template: tp.saveNew(user, { name: b.name, lang: b.lang, tasks: b.tasks }) }, 201);
}, { employer: true });

import { body, json, route } from "@/lib/server/api";
import * as tp from "@/lib/server/templates";

/** Save this week as a template: { name, from (the week's first date), lang } */
export const POST = route(async (req, user) => {
  const b = await body(req);
  return json({ template: tp.saveWeek(user, { name: b.name, from: b.from, lang: b.lang }) }, 201);
}, { employer: true });

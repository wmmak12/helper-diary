import { body, json, route } from "@/lib/server/api";
import * as tp from "@/lib/server/templates";

/** Put on calendar: { source: "sample:<key>" | "mine:<id>", name, lang, tasks, start } → { added, application, start, name } */
export const POST = route(async (req, user) => {
  const b = await body(req);
  return json(await tp.apply(user, { source: b.source, name: b.name, lang: b.lang, tasks: b.tasks, start: b.start }), 201);
}, { employer: true });

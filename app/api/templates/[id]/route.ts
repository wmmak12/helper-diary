import { body, intId, json, route } from "@/lib/server/api";
import * as tp from "@/lib/server/templates";

/** Rename or edit one of the household's own templates: { name?, tasks? } */
export const PATCH = route<{ id: string }>(async (req, _user, { id }) => {
  const b = await body(req);
  return json({ template: tp.saveMine(intId(id), { name: b.name, tasks: b.tasks }) });
}, { employer: true });

/** Delete it; tasks it already put on the calendar stay. */
export const DELETE = route<{ id: string }>(async (_req, _user, { id }) => {
  tp.deleteMine(intId(id));
  return json({ ok: true });
}, { employer: true });

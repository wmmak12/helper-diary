import { body, intId, json, route } from "@/lib/server/api";
import { deleteDish, dishFor, saveDish, type DishPatch } from "@/lib/server/kitchen";

export const GET = route<{ id: string }>(async (_req, user, { id }) => json({ dish: dishFor(user, intId(id)) }));

/** {name?, photo?} adder or employer; {favourite?, note?} employers; {ingredients?, steps?} anyone; lang = the writer's. */
export const PATCH = route<{ id: string }>(async (req, user, { id }) => json({ dish: saveDish(user, intId(id), await body<DishPatch>(req)) }));

export const DELETE = route<{ id: string }>(async (_req, user, { id }) => {
  deleteDish(user, intId(id));
  return json({ ok: true });
});

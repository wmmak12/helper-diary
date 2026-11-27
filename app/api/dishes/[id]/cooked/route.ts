import { intId, json, route } from "@/lib/server/api";
import { cookedToday } from "@/lib/server/kitchen";

/** The helper's Cooked today; once a day. */
export const POST = route<{ id: string }>(async (_req, user, { id }) => json({ dish: cookedToday(user, intId(id)) }));

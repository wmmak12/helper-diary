import { body, json, route } from "@/lib/server/api";
import * as tp from "@/lib/server/templates";

/** { tasks, start } → the first week from start, day by day, with tasks already on the calendar marked. */
export const POST = route(async (req) => {
  const b = await body(req);
  return json({ preview: tp.previewFor({ tasks: b.tasks, start: b.start }) });
}, { employer: true });

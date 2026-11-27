import { body, intId, json, route, str } from "@/lib/server/api";
import * as hh from "@/lib/server/household";

/** 2.0: move one task off `from` onto `to` (today or later). For a repeating task only that date's occurrence moves. */
export const POST = route<{ id: string }>(async (req, _user, { id }) => {
  const b = await body(req);
  return json(hh.moveTask(intId(id), str(b.from, 10), str(b.to, 10)));
}, { employer: true });

import { intId, json, route } from "@/lib/server/api";
import * as hh from "@/lib/server/household";

export const DELETE = route<{ id: string }>(async (_req, _user, { id }) => {
  hh.deleteItem(intId(id));
  return json({ ok: true });
}, { employer: true });

import { intId, json, route } from "@/lib/server/api";
import * as tp from "@/lib/server/templates";

/** Remove its tasks: takes off every task this application added, from today on. → { removed } */
export const DELETE = route<{ id: string }>(async (_req, _user, { id }) => json(tp.removeApplication(intId(id))), { employer: true });

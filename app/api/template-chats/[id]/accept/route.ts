import { body, intId, json, route } from "@/lib/server/api";
import { acceptProposal } from "@/lib/server/tplchat";

/** Save the proposal under My templates: { name }. Nothing goes on the calendar. */
export const POST = route<{ id: string }>(async (req, user, { id }) => json(acceptProposal(user, intId(id), await body(req))), { employer: true });

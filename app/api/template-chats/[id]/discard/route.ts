import { intId, json, route } from "@/lib/server/api";
import { discardProposal } from "@/lib/server/tplchat";

/** Drop the proposal; the chat stays and can carry on. */
export const POST = route<{ id: string }>(async (_req, _user, { id }) => json(discardProposal(intId(id))), { employer: true });

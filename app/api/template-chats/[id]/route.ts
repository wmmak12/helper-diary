import { body, intId, json, route } from "@/lib/server/api";
import { editProposal, getChat } from "@/lib/server/tplchat";

/** One chat: its messages and last proposal, as left (no model call). */
export const GET = route<{ id: string }>(async (_req, _user, { id }) => json(getChat(intId(id))), { employer: true });

/** The employer's edits on the proposal card: { tasks } (no model call). */
export const PATCH = route<{ id: string }>(async (req, _user, { id }) => json(editProposal(intId(id), await body(req))), { employer: true });

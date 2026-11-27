import { body, intId, json, route } from "@/lib/server/api";
import { sendMessage } from "@/lib/server/tplchat";

/** Send a message: { text }. The only call that reaches the model. 503 ai_unavailable saves nothing. */
export const POST = route<{ id: string }>(async (req, user, { id }) => json(await sendMessage(user, intId(id), await body(req))), { employer: true });

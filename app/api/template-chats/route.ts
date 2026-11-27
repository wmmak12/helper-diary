import { body, json, route } from "@/lib/server/api";
import { startChat } from "@/lib/server/tplchat";

// 4.0: AI template helper chats, employers only. 5.2: past chats are no longer listed (no GET).

/** Start a chat with its first message: { text, base_ref?, base_name?, base_tasks? }. 503 ai_unavailable saves nothing. */
export const POST = route(async (req, user) => json(await startChat(user, await body(req)), 201), { employer: true });

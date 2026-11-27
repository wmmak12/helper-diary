import { intId, json, route } from "@/lib/server/api";
import { saveFacts } from "@/lib/server/tplchat";

/** 5.2 Save to Your household: add what this AI reply offered to the household profile, overwriting nothing. No model call. */
export const POST = route<{ id: string; mid: string }>(async (_req, user, { id, mid }) => json(saveFacts(user, intId(id), intId(mid))), { employer: true });

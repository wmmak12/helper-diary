import { body, json, route } from "@/lib/server/api";
import { getProfile, saveProfile } from "@/lib/server/tplchat";

// 4.0: the household profile the AI template helper writes from. Employers only; the helper never sees it.
export const GET = route(async () => json({ profile: getProfile() }), { employer: true });

/** Replace it: { members: [{ name, age }], pets: [], bedrooms, bathrooms, floors, garden, matters } */
export const PUT = route(async (req, user) => json({ profile: saveProfile(user, await body(req)) }), { employer: true });

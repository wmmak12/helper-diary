import { json, route } from "@/lib/server/api";
import { members } from "@/lib/server/auth";

export const GET = route(async () =>
  json({ members: members().map((m) => ({ id: m.id, name: m.name, login: m.login, role: m.role, is_admin: !!m.is_admin, lang: m.lang })) }),
);

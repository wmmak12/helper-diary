import { body, json, route, str } from "@/lib/server/api";
import { run, one } from "@/lib/server/db";
import { isLang } from "@/lib/languages";
import type { User } from "@/lib/server/auth";
import { meOf } from "@/lib/server/session";
import { kickBackfill } from "@/lib/server/backfill";

export const GET = route(async (_req, user) => json({ me: meOf(user) }));

export const PATCH = route(async (req, user) => {
  const b = await body(req);
  if (b.lang !== undefined && isLang(b.lang) && b.lang !== user.lang) {
    run("UPDATE users SET lang = ? WHERE id = ?", b.lang, user.id);
    void kickBackfill(); // a language new to the household is back-filled once (lib/server/backfill.ts)
  }
  const name = str(b.name, 60).trim();
  if (name) run("UPDATE users SET name = ? WHERE id = ?", name, user.id);
  const u = one<User>("SELECT id, login, name, role, is_admin, lang, created_at FROM users WHERE id = ?", user.id)!;
  return json({ me: meOf(u) });
});

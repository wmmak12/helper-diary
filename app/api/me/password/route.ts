import { ApiError, body, json, route, str } from "@/lib/server/api";
import { changePassword, PasswordError, rateLimited, SESSION_COOKIE } from "@/lib/server/auth";
import type { PasswordChange } from "@/lib/types";

/**
 * PUT /api/me/password (PasswordChange) → { ok: true }. A member changes their own password (5.4): the current one
 * must match (403 wrong_password), the new one is 8 to 200 characters (400 bad_input), and every other device of
 * theirs is signed out. 8 tries per 15 minutes (429 too_many_attempts).
 */
export const PUT = route(async (req, user) => {
  const b = await body<Partial<PasswordChange>>(req);
  if (rateLimited(`password:${user.id}`, 8, 15 * 60_000)) throw new ApiError(429, "too_many_attempts");
  try {
    changePassword(user.id, str(b.current, 200), typeof b.password === "string" ? b.password : "", req.cookies.get(SESSION_COOKIE)?.value);
  } catch (e) {
    if (e instanceof PasswordError) throw new ApiError(e.code === "wrong_password" ? 403 : 400, e.code);
    throw e;
  }
  return json({ ok: true });
});

import { type NextRequest } from "next/server";
import { ApiError, body, checkOrigin, errorResponse, json, str } from "@/lib/server/api";
import { clientAddress, createSession, householdOpen, inviteRole, rateLimited, SESSION_COOKIE, signUp, SignUpError } from "@/lib/server/auth";
import { isLang } from "@/lib/languages";
import { cookieOptions, meOf } from "@/lib/server/session";
import { kickBackfill } from "@/lib/server/backfill";

// The role an invite code is for, so the sign-up form can show it as fixed. Rate-limited like sign-up.
export async function GET(req: NextRequest) {
  try {
    if (!householdOpen()) throw new ApiError(503, "closed");
    const ip = clientAddress(req.headers);
    if (rateLimited(`invite-lookup:${ip}`, 30, 15 * 60_000)) throw new ApiError(429, "too_many_attempts");
    const role = inviteRole(req.nextUrl.searchParams.get("code") ?? "");
    if (!role) throw new ApiError(404, "invalid_code");
    return json({ role });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    if (!householdOpen()) throw new ApiError(503, "closed");
    const ip = clientAddress(req.headers);
    if (rateLimited(`signup:${ip}`, 10, 15 * 60_000)) throw new ApiError(429, "too_many_attempts");
    const b = await body(req);
    try {
      const u = signUp({
        code: str(b.code, 40),
        login: str(b.login, 120),
        name: str(b.name, 60),
        password: str(b.password, 200),
        lang: isLang(b.lang) ? b.lang : null,
      });
      void kickBackfill(); // a language new to the household: earlier Notebook, tasks and dishes are translated into it
      const { token, maxAge } = createSession(u.id);
      const res = json({ me: meOf(u) });
      res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAge));
      return res;
    } catch (e) {
      if (e instanceof SignUpError) throw new ApiError(e.code === "login_taken" ? 409 : 400, e.code);
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}

import { type NextRequest } from "next/server";
import { ApiError, body, checkOrigin, errorResponse, json, str } from "@/lib/server/api";
import { clientAddress, createSession, householdOpen, passwordResetFor, rateLimited, ResetError, SESSION_COOKIE, redeemPasswordReset } from "@/lib/server/auth";
import { cookieOptions, meOf } from "@/lib/server/session";
import type { PasswordResetFor } from "@/lib/types";

// 5.5: a member who forgot their password uses the one-time code the owner made for them. Public, like sign-up:
// the code is the proof, so both calls are rate-limited per client.
const WINDOW = 15 * 60_000;

/** GET /api/reset?code= → PasswordResetFor, or 404 invalid_code. */
export async function GET(req: NextRequest) {
  try {
    if (!householdOpen()) throw new ApiError(503, "closed");
    if (rateLimited(`reset-lookup:${clientAddress(req.headers)}`, 30, WINDOW)) throw new ApiError(429, "too_many_attempts");
    const who: PasswordResetFor | null = passwordResetFor(req.nextUrl.searchParams.get("code") ?? "");
    if (!who) throw new ApiError(404, "invalid_code");
    return json(who, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/reset { code, password } → { me }, signed in. 400 invalid_code or bad_input. */
export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    if (!householdOpen()) throw new ApiError(503, "closed");
    const b = await body(req);
    if (rateLimited(`reset:${clientAddress(req.headers)}`, 10, WINDOW)) throw new ApiError(429, "too_many_attempts");
    try {
      const u = redeemPasswordReset(str(b.code, 40), typeof b.password === "string" ? b.password : "");
      const { token, maxAge } = createSession(u.id);
      const res = json({ me: meOf(u) });
      res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAge));
      return res;
    } catch (e) {
      if (e instanceof ResetError) throw new ApiError(400, e.code === "bad_input" ? "bad_input" : "invalid_code");
      throw e;
    }
  } catch (e) {
    return errorResponse(e);
  }
}

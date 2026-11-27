import { type NextRequest } from "next/server";
import { ApiError, body, checkOrigin, currentUser, errorResponse, json, str } from "@/lib/server/api";
import { clientAddress, createSession, destroySession, householdOpen, SESSION_COOKIE, signIn, signInBlocked } from "@/lib/server/auth";
import { cookieOptions, meOf } from "@/lib/server/session";
import { resumeBackfillOnce } from "@/lib/server/backfill";

export const dynamic = "force-dynamic";

/** Who is signed in, and whether the household is open for sign-in at all. */
export async function GET(req: NextRequest) {
  const open = householdOpen();
  resumeBackfillOnce();
  const u = currentUser(req);
  return json({ open, me: u ? meOf(u) : null });
}

export async function POST(req: NextRequest) {
  try {
    checkOrigin(req);
    if (!householdOpen()) throw new ApiError(503, "closed");
    const b = await body(req);
    const login = str(b.login, 120);
    if (signInBlocked(clientAddress(req.headers), login)) throw new ApiError(429, "too_many_attempts");
    const u = signIn(login, str(b.password, 200));
    if (!u) throw new ApiError(401, "wrong_credentials");
    const { token, maxAge } = createSession(u.id);
    const res = json({ me: meOf(u) });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions(maxAge));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    checkOrigin(req);
    destroySession(req.cookies.get(SESSION_COOKIE)?.value);
    const res = json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

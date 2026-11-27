import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, userForToken, type User } from "./auth";

// JSON API helpers. The API under app/api/** is the contract the 2.0 phone apps reuse: JSON in, JSON out,
// a session cookie for identity, and every check done here on the server.

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Refuse cross-site writes: the Origin (or Referer) must match the host the request came to. */
export function checkOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin) throw new ApiError(403, "bad_origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "bad_origin");
  }
  if (!host || originHost !== host) throw new ApiError(403, "bad_origin");
}

export function currentUser(req: NextRequest): User | null {
  return userForToken(req.cookies.get(SESSION_COOKIE)?.value);
}

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, user: User, params: P) => Promise<Response> | Response;

export function route<P = Record<string, string>>(
  handler: Handler<P>,
  opts: { employer?: boolean; admin?: boolean } = {},
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      checkOrigin(req);
      const user = currentUser(req);
      if (!user) throw new ApiError(401, "signed_out");
      if (opts.admin && !user.is_admin) throw new ApiError(403, "admin_only");
      if (opts.employer && user.role !== "employer") throw new ApiError(403, "employer_only");
      return await handler(req, user, (await ctx.params) ?? ({} as P));
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return json({ error: e.code, message: e.message }, e.status);
  console.error(e);
  return json({ error: "server_error" }, 500);
}

/** The largest JSON body any route reads. */
const MAX_JSON = 1024 * 1024;
/** The largest form upload (a photo or a recording): their 8 MB file limit plus room for the form around it. */
export const MAX_UPLOAD = 8 * 1024 * 1024 + 64 * 1024;

/**
 * The request's body, read in pieces and refused (413) as soon as it passes `max` bytes, so an oversized one is never
 * held in memory whole. Null when the request has no body.
 */
async function capped(req: Request, max: number): Promise<Uint8Array | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) throw new ApiError(413, "too_large");
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      throw new ApiError(413, "too_large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return all;
}

/** The request's JSON body, at most 1 MB (413 past it). */
export async function body<T = Record<string, unknown>>(req: NextRequest): Promise<T> {
  const bytes = await capped(req, MAX_JSON);
  if (!bytes) throw new ApiError(400, "bad_json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(400, "bad_json");
  }
  // every route reads fields off an object; `null` or a bare string used to end in a 500
  if (typeof parsed !== "object" || parsed === null) throw new ApiError(400, "bad_json");
  return parsed as T;
}

/**
 * The request's form upload, at most MAX_UPLOAD bytes (413 past it), or null when it is not a form. Use this, never
 * req.formData(), which reads the whole body into memory before any limit can be checked.
 */
export async function formBody(req: Request): Promise<FormData | null> {
  const bytes = await capped(req, MAX_UPLOAD);
  if (!bytes) return null;
  const type = req.headers.get("content-type") ?? "";
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { "content-type": type } }).formData().catch(() => null);
}

export function str(v: unknown, max = 4000): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

export function intId(v: unknown): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(404, "not_found");
  return n;
}

/** Today's date (yyyy-mm-dd) in the household's time zone; HOUSEHOLD_TZ, default Asia/Singapore. */
export function today(d = new Date()): string {
  const tz = process.env.HOUSEHOLD_TZ || "Asia/Singapore";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function weekday(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

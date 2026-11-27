import crypto from "node:crypto";
import { all, getDb, now, one, run, tx } from "./db";
import { isLang, type Lang } from "../languages";

export type Role = "employer" | "helper";
export type User = {
  id: number;
  login: string;
  name: string;
  role: Role;
  is_admin: number;
  lang: Lang | null;
  created_at: number;
};

export const SESSION_COOKIE = "dt_session";
const SESSION_DAYS = 60;

// ---- passwords: argon2id (node:crypto) ----
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const params = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
  const hash = crypto.argon2Sync("argon2id", { message: password, nonce: salt, ...params });
  return `argon2id$m=${params.memory},t=${params.passes},p=${params.parallelism}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "argon2id" || !saltB64 || !hashB64) return false;
  const m = /m=(\d+),t=(\d+),p=(\d+)/.exec(p ?? "");
  if (!m) return false;
  const expected = Buffer.from(hashB64, "base64");
  const got = crypto.argon2Sync("argon2id", {
    message: password,
    nonce: Buffer.from(saltB64, "base64"),
    memory: Number(m[1]),
    passes: Number(m[2]),
    parallelism: Number(m[3]),
    tagLength: expected.length,
  });
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

// ---- admin bootstrap ----
let adminChecked = false;
export function ensureAdmin(): void {
  if (adminChecked) return;
  getDb();
  const email = process.env.APP_ADMIN_EMAIL?.trim();
  const password = process.env.APP_ADMIN_PASSWORD;
  if (email && password) {
    const existing = one("SELECT id FROM users WHERE login = ?", email);
    if (!existing) {
      run(
        "INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES (?,?,?,?,1,NULL,?)",
        email,
        email.split("@")[0] || "Admin",
        hashPassword(password),
        "employer",
        now(),
      );
    }
  }
  adminChecked = true;
}

export function householdOpen(): boolean {
  ensureAdmin();
  return !!one("SELECT id FROM users WHERE removed_at IS NULL LIMIT 1");
}

// ---- rate limiting (per key, sliding window, stored so it holds across restarts) ----
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const t = now();
  run("DELETE FROM rate WHERE at < ?", t - 24 * 3600_000);
  const n = one<{ n: number }>("SELECT COUNT(*) AS n FROM rate WHERE key = ? AND at > ?", key, t - windowMs)?.n ?? 0;
  if (n >= max) return true;
  run("INSERT INTO rate (key, at) VALUES (?, ?)", key, t);
  return false;
}

/**
 * Who is calling, for rate limits: the last X-Forwarded-For entry, which the nearest proxy added. Earlier entries
 * are whatever the caller sent, so they are ignored. Without a proxy every caller is "local".
 */
export function clientAddress(headers: Headers): string {
  const parts = (headers.get("x-forwarded-for") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return parts.at(-1) ?? "local";
}

const WINDOW = 15 * 60_000;
/**
 * Count one sign-in attempt and say whether it is refused: 20 per client, 8 per login, 120 overall, per 15 minutes.
 * The overall limit bounds the password hashing a flood can cost when a caller can forge its address; it only
 * closes sign-in, and everyone already signed in carries on.
 */
export function signInBlocked(client: string, login: string): boolean {
  return (
    rateLimited(`signin:${client}`, 20, WINDOW) ||
    rateLimited("signin-all", 120, WINDOW) ||
    rateLimited(`signin-login:${login.trim().toLowerCase()}`, 8, WINDOW)
  );
}

// ---- sessions ----
function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createSession(userId: number): { token: string; maxAge: number } {
  const token = crypto.randomBytes(32).toString("base64url");
  const maxAge = SESSION_DAYS * 24 * 3600;
  run("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)", tokenHash(token), userId, now() + maxAge * 1000);
  return { token, maxAge };
}

export function destroySession(token: string | undefined) {
  if (token) run("DELETE FROM sessions WHERE token_hash = ?", tokenHash(token));
}

export function userForToken(token: string | undefined): User | null {
  if (!token) return null;
  ensureAdmin();
  const u = one<User>(
    `SELECT u.id, u.login, u.name, u.role, u.is_admin, u.lang, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.removed_at IS NULL`,
    tokenHash(token),
    now(),
  );
  if (!u) return null;
  return { ...u, lang: isLang(u.lang) ? u.lang : null };
}

export function signIn(login: string, password: string): User | null {
  ensureAdmin();
  const u = one<User & { password_hash: string }>(
    "SELECT * FROM users WHERE login = ? AND removed_at IS NULL",
    login.trim(),
  );
  if (!u) {
    // spend similar time so a missing account is not distinguishable by timing
    verifyPassword(password, "argon2id$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    return null;
  }
  return verifyPassword(password, u.password_hash) ? u : null;
}

export class PasswordError extends Error {
  constructor(public code: "wrong_password" | "bad_input") {
    super(code);
  }
}

/**
 * A member changes their own password (5.4). It needs the current one; every other session of theirs ends, and
 * the one that made the change (`keepToken`) stays signed in.
 */
export function changePassword(userId: number, current: string, next: string, keepToken: string | undefined): void {
  if (next.length < 8 || next.length > 200) throw new PasswordError("bad_input");
  const u = one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ? AND removed_at IS NULL", userId);
  if (!u || !verifyPassword(current, u.password_hash)) throw new PasswordError("wrong_password");
  const hash = hashPassword(next);
  tx(() => {
    run("UPDATE users SET password_hash = ? WHERE id = ?", hash, userId);
    run("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?", userId, keepToken ? tokenHash(keepToken) : "");
  });
}

// ---- forgotten passwords (5.5): a one-time code the owner makes for a member ----
const RESET_HOURS = 24;

export class ResetError extends Error {
  constructor(public code: "invalid_code" | "bad_input" | "not_found") {
    super(code);
  }
}

/**
 * A reset code for a member who forgot their password. Only its hash is stored. It works once, for 24 hours, and a
 * newer code for the same member replaces it. The owner's own account never gets one (scripts/reset-owner-password.mjs).
 */
export function makePasswordReset(userId: number, byUserId: number): { code: string; expires_at: number } {
  if (!one("SELECT id FROM users WHERE id = ? AND removed_at IS NULL AND is_admin = 0", userId)) throw new ResetError("not_found");
  const code = makeInviteCode();
  const expires_at = now() + RESET_HOURS * 3600_000;
  tx(() => {
    run("DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL", userId);
    run("INSERT INTO password_resets (code_hash, user_id, created_by, created_at, expires_at) VALUES (?,?,?,?,?)", tokenHash(code), userId, byUserId, now(), expires_at);
  });
  return { code, expires_at };
}

const RESET_WHERE = "r.code_hash = ? AND r.used_at IS NULL AND r.expires_at > ? AND u.removed_at IS NULL AND u.is_admin = 0";

/** Whose password an unused, unexpired reset code sets, or null. */
export function passwordResetFor(code: string): { name: string; login: string; lang: Lang | null } | null {
  const u = one<{ name: string; login: string; lang: string | null }>(
    `SELECT u.name, u.login, u.lang FROM password_resets r JOIN users u ON u.id = r.user_id WHERE ${RESET_WHERE}`,
    tokenHash(normaliseCode(code)),
    now(),
  );
  return u ? { name: u.name, login: u.login, lang: isLang(u.lang) ? u.lang : null } : null;
}

/** Use a reset code: the member's password becomes `password` and every session of theirs ends. */
export function redeemPasswordReset(code: string, password: string): User {
  if (password.length < 8 || password.length > 200) throw new ResetError("bad_input");
  const codeHash = tokenHash(normaliseCode(code));
  const live = () => one<{ user_id: number }>(`SELECT r.user_id FROM password_resets r JOIN users u ON u.id = r.user_id WHERE ${RESET_WHERE}`, codeHash, now());
  // The code is checked before the password is hashed: hashing blocks the server for a moment, and this route is open
  // to anyone signed out, so a wrong code must cost nothing but a lookup.
  if (!live()) throw new ResetError("invalid_code");
  const hash = hashPassword(password);
  return tx(() => {
    const r = live();
    if (!r) throw new ResetError("invalid_code");
    if (run("UPDATE password_resets SET used_at = ? WHERE code_hash = ? AND used_at IS NULL", now(), codeHash).changes !== 1) throw new ResetError("invalid_code");
    run("UPDATE users SET password_hash = ? WHERE id = ?", hash, r.user_id);
    run("DELETE FROM sessions WHERE user_id = ?", r.user_id);
    const u = one<User>("SELECT id, login, name, role, is_admin, lang, created_at FROM users WHERE id = ?", r.user_id)!;
    return { ...u, lang: isLang(u.lang) ? u.lang : null };
  });
}

// ---- invites ----
export function makeInviteCode(): string {
  // 10 chars from an unambiguous alphabet, ~50 bits
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

export function normaliseCode(code: string): string {
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length === 10 ? `${c.slice(0, 5)}-${c.slice(5)}` : code.trim().toUpperCase();
}

export class SignUpError extends Error {
  constructor(public code: "invalid_code" | "login_taken" | "bad_input") {
    super(code);
  }
}

/** The role an unused, unrevoked invite was made for, or null when the code cannot be used. */
export function inviteRole(code: string): Role | null {
  const inv = one<{ role: string | null }>(
    "SELECT role FROM invites WHERE code = ? AND used_by IS NULL AND revoked_at IS NULL",
    normaliseCode(code),
  );
  return inv?.role === "helper" || inv?.role === "employer" ? inv.role : null;
}

/** Sign up with an invite. The role always comes from the invite the admin made, never from the person signing up. */
export function signUp(input: { code: string; login: string; name: string; password: string; lang: Lang | null }): User {
  const login = input.login.trim();
  const name = input.name.trim() || login.split("@")[0];
  if (login.length < 3 || login.length > 120 || input.password.length < 8 || input.password.length > 200) {
    throw new SignUpError("bad_input");
  }
  const code = normaliseCode(input.code);
  const invited = (): Role | null => {
    const inv = one<{ role: string | null }>("SELECT role FROM invites WHERE code = ? AND used_by IS NULL AND revoked_at IS NULL", code);
    return inv?.role === "helper" || inv?.role === "employer" ? inv.role : null;
  };
  // As with reset codes: the invite and the login are checked before the password is hashed, so a signed-out caller
  // without a working invite cannot make the server hash anything.
  if (!invited()) throw new SignUpError("invalid_code");
  if (one("SELECT id FROM users WHERE login = ?", login)) throw new SignUpError("login_taken");
  const hash = hashPassword(input.password);
  return tx(() => {
    const role = invited();
    if (!role) throw new SignUpError("invalid_code");
    if (one("SELECT id FROM users WHERE login = ?", login)) throw new SignUpError("login_taken");
    const { id } = run(
      "INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES (?,?,?,?,0,?,?)",
      login,
      name.slice(0, 60),
      hash,
      role,
      input.lang,
      now(),
    );
    const used = run("UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL AND revoked_at IS NULL", id, now(), code);
    if (used.changes !== 1) throw new SignUpError("invalid_code");
    return one<User>("SELECT id, login, name, role, is_admin, lang, created_at FROM users WHERE id = ?", id)!;
  });
}

export function members() {
  return all<User>(
    "SELECT id, login, name, role, is_admin, lang, created_at FROM users WHERE removed_at IS NULL ORDER BY created_at",
  );
}

/** The helper's language, used as Talk's target. Falls back to Burmese before she joins. */
export function helperLang(): Lang {
  const h = one<{ lang: string | null }>(
    "SELECT lang FROM users WHERE role = 'helper' AND removed_at IS NULL ORDER BY created_at LIMIT 1",
  );
  return isLang(h?.lang) ? h!.lang as Lang : "my";
}

export function helperName(): string | null {
  return one<{ name: string }>("SELECT name FROM users WHERE role = 'helper' AND removed_at IS NULL ORDER BY created_at LIMIT 1")?.name ?? null;
}

/**
 * The languages this household reads (5.3): each member's chosen language, plus the helper's (Burmese before a helper
 * joins, since an employer may still show Talk to her on one phone). New texts are translated only into these.
 */
export function householdLangs(): Lang[] {
  const out = new Set<Lang>([helperLang()]);
  for (const r of all<{ lang: string | null }>("SELECT DISTINCT lang FROM users WHERE removed_at IS NULL AND lang IS NOT NULL")) {
    if (isLang(r.lang)) out.add(r.lang);
  }
  return [...out];
}

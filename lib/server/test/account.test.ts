// 5.4: a member changes their own password; sign-in attempts are limited per client, per login and overall.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { freshDataDir } from "./setup.ts";

freshDataDir();
const { run, one } = await import("../db.ts");
const auth = await import("../auth.ts");

function member(login: string, password: string): number {
  return run(
    "INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES (?,?,?,?,0,'en',?)",
    login, login, auth.hashPassword(password), "employer", Date.now(),
  ).id;
}
const sessions = (userId: number) => one<{ n: number }>("SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?", userId)!.n;

test("changing a password needs the current one, and signs out the member's other devices", () => {
  const id = member("mei", "first-password-1");
  const here = auth.createSession(id).token;
  const elsewhere = auth.createSession(id).token;
  const other = member("daniel", "daniel-password-1");
  const theirs = auth.createSession(other).token;

  assert.throws(() => auth.changePassword(id, "not-the-password", "second-password-2", here), (e: unknown) => e instanceof auth.PasswordError && e.code === "wrong_password");
  assert.throws(() => auth.changePassword(id, "first-password-1", "short", here), (e: unknown) => e instanceof auth.PasswordError && e.code === "bad_input");
  assert.throws(() => auth.changePassword(id, "first-password-1", "x".repeat(201), here), (e: unknown) => e instanceof auth.PasswordError && e.code === "bad_input");
  assert.ok(auth.signIn("mei", "first-password-1"), "a refused change leaves the password as it was");
  assert.equal(sessions(id), 2);

  auth.changePassword(id, "first-password-1", "second-password-2", here);
  assert.equal(auth.signIn("mei", "first-password-1"), null, "the old password no longer signs in");
  assert.ok(auth.signIn("mei", "second-password-2"));
  assert.ok(auth.userForToken(here), "the device that changed it stays signed in");
  assert.equal(auth.userForToken(elsewhere), null, "every other device of theirs is signed out");
  assert.ok(auth.userForToken(theirs), "nobody else is signed out");
});

test("the client address is the one the nearest proxy added, not one the caller typed", () => {
  const h = (v?: string) => new Headers(v === undefined ? {} : { "x-forwarded-for": v });
  assert.equal(auth.clientAddress(h("203.0.113.9")), "203.0.113.9");
  assert.equal(auth.clientAddress(h("1.2.3.4, 203.0.113.9")), "203.0.113.9", "a forged first entry is ignored");
  assert.equal(auth.clientAddress(h(" 1.2.3.4 ,5.6.7.8 , 203.0.113.9 ")), "203.0.113.9");
  assert.equal(auth.clientAddress(h()), "local");
  assert.equal(auth.clientAddress(h(" , ")), "local");
});

test("sign-in attempts stop at 8 per login, 20 per client and 120 overall in 15 minutes", () => {
  // one login, a new client each time
  for (let i = 1; i <= 8; i++) assert.equal(auth.signInBlocked(`a${i}`, "Mei"), false, `try ${i}`);
  assert.equal(auth.signInBlocked("a9", "mei"), true, "the 9th try at one login is refused, whatever the letter case");
  // one client, a new login each time
  for (let i = 1; i <= 20; i++) assert.equal(auth.signInBlocked("b", `login${i}`), false, `try ${i}`);
  assert.equal(auth.signInBlocked("b", "login21"), true, "the 21st try from one client is refused");
  // new client and new login every time. 29 are counted so far (the refused 9th try at "mei" counts overall; the
  // 21st from client "b" was refused before the overall count), so 91 more are let through
  for (let i = 1; i <= 91; i++) assert.equal(auth.signInBlocked(`c${i}`, `user${i}`), false, `try ${i}`);
  assert.equal(auth.signInBlocked("c92", "user92"), true, "the 121st try overall is refused");
  assert.equal(auth.signInBlocked("fresh", "fresh"), true);
});

// 5.5: a forgotten password. The owner makes a one-time reset code for a member; the owner's own is a server script.
test("a reset code sets a member's password once, within a day, and ends their sessions", () => {
  const owner = run("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES ('owner@example.test','Owner',?,'employer',1,'en',?)", auth.hashPassword("owner-password-1"), Date.now()).id;
  const id = member("mya", "forgotten-password-1");
  run("UPDATE users SET lang = 'my', name = 'Mya' WHERE id = ?", id);
  const phone = auth.createSession(id).token;

  const first = auth.makePasswordReset(id, owner);
  assert.match(first.code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
  assert.ok(first.expires_at > Date.now() + 23 * 3600_000 && first.expires_at <= Date.now() + 24 * 3600_000);
  assert.equal(one<{ n: number }>("SELECT COUNT(*) AS n FROM password_resets WHERE code_hash = ?", first.code)!.n, 0, "the code itself is not stored");
  assert.deepEqual(auth.passwordResetFor(first.code), { name: "Mya", login: "mya", lang: "my" });
  assert.deepEqual(auth.passwordResetFor(first.code.toLowerCase().replace("-", " ")), { name: "Mya", login: "mya", lang: "my" }, "typed loosely");
  assert.equal(auth.passwordResetFor("AAAAA-AAAAA"), null);

  const second = auth.makePasswordReset(id, owner);
  assert.equal(auth.passwordResetFor(first.code), null, "a newer code replaces the earlier one");
  const bad = (fn: () => unknown, code: string) => assert.throws(fn, (e: unknown) => e instanceof auth.ResetError && e.code === code);
  bad(() => auth.redeemPasswordReset(first.code, "brand-new-password-2"), "invalid_code");
  bad(() => auth.redeemPasswordReset(second.code, "short"), "bad_input");
  assert.ok(auth.signIn("mya", "forgotten-password-1"), "nothing changes until the code is used");
  assert.ok(auth.userForToken(phone));

  const u = auth.redeemPasswordReset(second.code, "brand-new-password-2");
  assert.equal(u.login, "mya");
  assert.equal(auth.signIn("mya", "forgotten-password-1"), null);
  assert.ok(auth.signIn("mya", "brand-new-password-2"));
  assert.equal(auth.userForToken(phone), null, "every device signed in with the old password is signed out");
  bad(() => auth.redeemPasswordReset(second.code, "another-password-3"), "invalid_code");
  assert.equal(auth.passwordResetFor(second.code), null, "a used code is spent");

  const late = auth.makePasswordReset(id, owner);
  run("UPDATE password_resets SET expires_at = ? WHERE user_id = ? AND used_at IS NULL", Date.now() - 1000, id);
  assert.equal(auth.passwordResetFor(late.code), null, "a code older than a day is spent");
  bad(() => auth.redeemPasswordReset(late.code, "another-password-3"), "invalid_code");

  bad(() => auth.makePasswordReset(owner, owner), "not_found");
  const gone = member("left", "left-password-1");
  const theirs = auth.makePasswordReset(gone, owner);
  run("UPDATE users SET removed_at = ? WHERE id = ?", Date.now(), gone);
  assert.equal(auth.passwordResetFor(theirs.code), null, "a removed member's code is spent");
  bad(() => auth.makePasswordReset(gone, owner), "not_found");
});

test("the server script sets the owner's password in the form the app checks", async () => {
  const { spawnSync } = await import("node:child_process");
  const owner = one<{ id: number }>("SELECT id FROM users WHERE is_admin = 1")!.id;
  const session = auth.createSession(owner).token;
  const script = new URL("../../../scripts/reset-owner-password.mjs", import.meta.url).pathname;
  const go = (input: string) => spawnSync(process.execPath, [script], { input, env: { ...process.env, DATA_DIR: process.env.DATA_DIR }, encoding: "utf8" });

  const short = go("short\n");
  assert.notEqual(short.status, 0);
  assert.ok(auth.signIn("owner@example.test", "owner-password-1"), "a refused password changes nothing");

  const ok = go("owner-password-from-script\n");
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /owner@example\.test/);
  assert.equal(auth.signIn("owner@example.test", "owner-password-1"), null);
  assert.ok(auth.signIn("owner@example.test", "owner-password-from-script"));
  assert.equal(auth.userForToken(session), null, "the owner's devices are signed out");
  assert.ok(auth.signIn("mya", "brand-new-password-2"), "nobody else is touched");
});

test("a wrong reset code or invite costs no password hashing, so a signed-out flood cannot stall the server", () => {
  const owner = one<{ id: number }>("SELECT id FROM users WHERE is_admin = 1")!.id;
  const id = member("siti", "siti-password-1");
  const argon2Sync = crypto.argon2Sync;
  let hashed = 0;
  crypto.argon2Sync = ((...a: Parameters<typeof argon2Sync>) => (hashed++, argon2Sync(...a))) as typeof argon2Sync;
  try {
    for (let i = 0; i < 20; i++) {
      assert.throws(() => auth.redeemPasswordReset(`WRONG-CODE${i % 10}`, "flood-password-1"), (e: unknown) => e instanceof auth.ResetError && e.code === "invalid_code");
      assert.throws(() => auth.signUp({ code: `WRONG-CODE${i % 10}`, login: `flood${i}`, name: "", password: "flood-password-1", lang: null }), (e: unknown) => e instanceof auth.SignUpError && e.code === "invalid_code");
    }
    assert.equal(hashed, 0, "40 wrong codes, no hashing");
    const reset = auth.makePasswordReset(id, owner);
    auth.redeemPasswordReset(reset.code, "siti-password-2");
    assert.equal(hashed, 1, "a working code still sets the password");
    const code = auth.makeInviteCode();
    run("INSERT INTO invites (code, role, created_by, created_at) VALUES (?,?,?,?)", code, "helper", owner, Date.now());
    assert.throws(() => auth.signUp({ code, login: "siti", name: "", password: "flood-password-1", lang: null }), (e: unknown) => e instanceof auth.SignUpError && e.code === "login_taken");
    assert.equal(hashed, 1, "a taken login is refused before hashing too");
    assert.equal(auth.signUp({ code, login: "nurul", name: "Nurul", password: "nurul-password-1", lang: "id" }).role, "helper");
    assert.equal(hashed, 2);
  } finally {
    crypto.argon2Sync = argon2Sync;
  }
  assert.ok(auth.signIn("siti", "siti-password-2"));
});

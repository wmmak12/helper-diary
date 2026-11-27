#!/usr/bin/env node
// Set a new password for the household owner when it has been forgotten. Being able to run this on the server is
// the proof that you are the owner. Every device the owner is signed in on is signed out.
// Usage, where the app's data folder is:
//   DATA_DIR=/data node reset-owner-password.mjs            (asks for the new password)
//   printf '%s\n' 'the new password' | DATA_DIR=/data node reset-owner-password.mjs
// Other members' passwords are reset from Settings › Household by the owner.
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const dir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const file = path.join(dir, "household.sqlite");
if (!fs.existsSync(file)) {
  console.error(`No database at ${file}. Set DATA_DIR to the app's data folder.`);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
if (process.stdin.isTTY) process.stdout.write("New owner password (8 to 200 characters, shown as you type): ");
const password = await new Promise((resolve) => {
  rl.once("line", (line) => resolve(line));
  rl.once("close", () => resolve(""));
});
rl.close();
if (password.length < 8 || password.length > 200) {
  console.error("The password must be 8 to 200 characters. Nothing was changed.");
  process.exit(1);
}

// The same form lib/server/auth.ts hashPassword() writes and verifyPassword() reads (lib/server/test/account.test.ts checks it).
const params = { memory: 19456, passes: 2, parallelism: 1, tagLength: 32 };
const salt = crypto.randomBytes(16);
const hash = crypto.argon2Sync("argon2id", { message: password, nonce: salt, ...params });
const stored = `argon2id$m=${params.memory},t=${params.passes},p=${params.parallelism}$${salt.toString("base64")}$${hash.toString("base64")}`;

const db = new DatabaseSync(file);
db.exec("PRAGMA busy_timeout = 5000;");
const owner = db.prepare("SELECT id, login FROM users WHERE is_admin = 1 AND removed_at IS NULL ORDER BY id LIMIT 1").get();
if (!owner) {
  console.error("This database has no owner account yet. Start the app once with APP_ADMIN_EMAIL and APP_ADMIN_PASSWORD set.");
  process.exit(1);
}
db.exec("BEGIN IMMEDIATE");
db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(stored, owner.id);
const out = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(owner.id);
db.exec("COMMIT");
db.close();
console.log(`Password changed for ${owner.login}. Signed out ${out.changes} device(s). Sign in with the new password.`);

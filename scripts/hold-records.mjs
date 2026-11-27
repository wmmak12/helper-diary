#!/usr/bin/env node
// Read the silent hold records (1.4) from the server's database, oldest first.
// Usage (on the server, or on a copy of its DATA_DIR):
//   DATA_DIR=/data node scripts/hold-records.mjs [--user <sign-in name>] [--hours 24] [--json]
// Each record also appears in the server log as one line starting with "[hold-record]".
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const dir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const file = path.join(dir, "household.sqlite");
if (!fs.existsSync(file)) {
  console.error(`No database at ${file}. Set DATA_DIR to the server's data directory.`);
  process.exit(1);
}
const db = new DatabaseSync(file, { readOnly: true });
const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='hold_records'").get();
if (!hasTable) {
  console.log("No hold records yet (this database predates 1.4).");
  process.exit(0);
}
const since = Date.now() - Number(opt("--hours") ?? 24 * 30) * 3600_000;
const login = opt("--user");
const rows = db
  .prepare(
    `SELECT r.id, r.kind, r.page, r.data, r.created_at, u.login FROM hold_records r JOIN users u ON u.id = r.user_id
     WHERE r.created_at >= ? ${login ? "AND u.login = ? COLLATE NOCASE" : ""} ORDER BY r.id`,
  )
  .all(...(login ? [since, login] : [since]));

if (args.includes("--json")) {
  for (const r of rows) console.log(JSON.stringify({ id: r.id, at: r.created_at, user: r.login, ...JSON.parse(r.data) }));
  process.exit(0);
}
const time = (ms) => new Date(ms).toISOString().replace("T", " ").slice(0, 23);
let page = null;
for (const r of rows) {
  const d = JSON.parse(r.data);
  if (d.page !== page) {
    page = d.page;
    console.log(`\n=== page load ${page} · ${r.login} · ${d.ua}`);
  }
  if (d.kind !== "hold") {
    console.log(`${time(r.created_at)}  ${d.kind}${d.talkId ? ` (talk ${d.talkId})` : ""}`);
    continue;
  }
  const held = d.releaseAt ? `${d.releaseAt - d.pressAt}ms` : "?";
  console.log(
    `${time(d.pressAt)}  HOLD ${d.lang} held ${held} → ${d.outcome}${d.problem ? ` (${d.problem})` : ""}` +
      ` · listening after ${d.listeningAfter ?? "never"}ms` +
      (d.waitedForPrevious != null ? ` · waited ${d.waitedForPrevious}ms for previous` : "") +
      (d.talkId ? ` · talk ${d.talkId}` : ""),
  );
  // 1.5: which way it went, and how fast the phone answered each start (warm = under 150ms: the recogniser stayed deaf on some phones)
  if (d.went)
    console.log(
      `    went: ${d.went.toUpperCase()}` +
        (d.starts?.length ? " · starts " + d.starts.map((x) => `#${x.rec} ${x.after ?? "?"}ms ${x.warm ? "warm" : x.warm === false ? "cold" : "never"} ${x.heard ? "heard" : "deaf"}`).join(", ") : ""),
    );
  for (const e of d.events) {
    const extra = [e.text != null ? JSON.stringify(e.text) : "", e.final ? "final" : "", e.error ? `${e.error}: ${e.message ?? ""}` : ""].filter(Boolean).join(" ");
    console.log(`    +${String(e.t).padStart(5)}ms  #${e.rec} ${e.type}${extra ? "  " + extra : ""}`);
  }
}
console.log(`\n${rows.length} record(s).`);

// A helper never sees a talk held before her account joined (5.3); employers see every talk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDataDir } from "./setup.ts";

freshDataDir();
const { run, one } = await import("../db.ts");
const hh = await import("../household.ts");
type User = import("../auth.ts").User;

const H = 3600_000;
const T = Date.now();
const today = (await import("../api.ts")).today(new Date(T - 2 * H));

function user(login: string, role: "employer" | "helper", createdAt: number): User {
  const id = run("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES (?,?,?,?,?,?,?)", login, login, "x", role, role === "employer" ? 1 : 0, role === "helper" ? "my" : "en", createdAt).id;
  return one<User>("SELECT id, login, name, role, is_admin, lang, created_at FROM users WHERE id = ?", id)!;
}
function talk(by: User, at: number, text: string): number {
  const id = run("INSERT INTO talks (lang, title, created_by, created_at, updated_at, drafted_at) VALUES ('en',?,?,?,?,?)", `About ${text}`, by.id, at, at, at).id;
  run("INSERT INTO talk_lines (talk_id, speaker, kind, text, lang, created_by, created_at) VALUES (?,?,'text',?,'en',?,?)", id, "employer", text, by.id, at);
  return id;
}

const boss = user("boss@example.test", "employer", T - 100 * H);
const oldTalk = talk(boss, T - 2 * H, "secret from before");
const helper = user("helper", "helper", T - 1 * H);
const newTalk = talk(boss, T - 0.5 * H, "hello after she joined");
// an entry auto-added from the old talk stays hers to read, without the way back to the talk
const entry = run(
  "INSERT INTO entries (section, title, body, lang, source_talk_id, auto_talk_id, created_at, updated_at) VALUES ('rules','Lock the gate','Always','en',?,?,?,?)",
  oldTalk, oldTalk, T - 2 * H, T - 2 * H,
).id;

test("helper: no talk from before she joined, anywhere", () => {
  assert.deepEqual(hh.listTalks(helper).map((t) => t.id), [newTalk]);
  assert.throws(() => hh.talkDetail(oldTalk, helper), (e: { status?: number }) => e.status === 404);
  assert.equal(hh.talkDetail(newTalk, helper).id, newTalk);
  assert.equal(hh.latestTalk(helper)?.id, newTalk);
  assert.equal(hh.dayTalk(T - 3 * H, T - 1.5 * H, helper), null);
  assert.deepEqual(hh.search(helper, "secret").filter((h) => h.type === "talk"), []);
  const day = hh.dayView(helper, today);
  assert.ok(day.talks.every((t) => t.id !== oldTalk));
  const e = hh.entryById(entry, helper);
  assert.equal(e.title, "Lock the gate");
  assert.equal(e.source_talk_id, null);
  assert.equal(e.auto_from?.talk_id, 0);
  assert.equal(e.auto_from?.title, null);
  assert.ok(!JSON.stringify([hh.listTalks(helper), e, day, hh.search(helper, "e")]).includes("secret"));
});

test("employer: every talk as before", () => {
  assert.deepEqual(hh.listTalks(boss).map((t) => t.id).sort(), [oldTalk, newTalk].sort());
  assert.equal(hh.talkDetail(oldTalk, boss).lines[0].text, "secret from before");
  assert.equal(hh.search(boss, "secret").filter((h) => h.type === "talk").length, 1);
  assert.equal(hh.entryById(entry, boss).source_talk_id, oldTalk);
  assert.equal(hh.entryById(entry, boss).auto_from?.title, "About secret from before");
});

// Translation targets and the one-time back-fill (5.3): a language new to the household is added to earlier entries,
// tasks and dishes without touching the translations already stored; items already done are not asked again; new texts
// go only into the household's languages. The model is a local stand-in speaking the OpenAI chat format.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { freshDataDir } from "./setup.ts";

freshDataDir();
const asked: string[][] = [];
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const { messages } = JSON.parse(raw) as { messages: { role: string; content: string }[] };
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    let reply: Record<string, unknown>;
    const fieldsAt = user.indexOf("Fields as JSON:\n");
    if (fieldsAt >= 0) {
      const fields = JSON.parse(user.slice(fieldsAt + 16)) as Record<string, string>;
      const langs = [...(/Languages: (.*?)\. Reply/.exec(system)?.[1] ?? "").matchAll(/(\w+) = /g)].map((m) => m[1]);
      asked.push(langs);
      reply = Object.fromEntries(langs.map((l) => [l, Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, `[${l}] ${v}`]))]));
    } else {
      const langs = [...(/with these keys: \{(.*?)\}/.exec(system)?.[1] ?? "").matchAll(/"(\w+)":/g)].map((m) => m[1]);
      asked.push(langs);
      const text = user.split("Text:\n")[1] ?? "";
      reply = Object.fromEntries(langs.map((l) => [l, `[${l}] ${text}`]));
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: "m", choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(reply) }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
after(() => server.close());
process.env.AI_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
process.env.AI_API_KEY = "test-key";
process.env.AI_MODEL = "m";

const { run, one } = await import("../db.ts");
const { kickBackfill, syncHouseholdLangs } = await import("../backfill.ts");
const { translateAll } = await import("../ai.ts");
const J = JSON.stringify;
const t = Date.now();

run("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES ('boss','Boss','x','employer',1,'en',?)", t);
run("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES ('h','H','x','helper',0,'my',?)", t);
const entry = run("INSERT INTO entries (section, title, body, lang, tr, steps, created_at, updated_at) VALUES ('rules','Gate','Lock it','en',?,?,?,?)",
  J({ title: { my: "MY gate" }, body: { my: "MY lock" }, steps: [{ my: "MY step" }] }), J([{ text: "Turn the key", photo: null }]), t, t).id;
const task = run("INSERT INTO tasks (title, note, lang, tr, kind, created_at, updated_at) VALUES ('Mop','Kitchen','en',?,'routine',?,?)", J({ title: { my: "MY mop" }, note: { my: "MY kitchen" } }), t, t).id;
const dish = run("INSERT INTO dishes (name, lang, tr, note, note_lang, note_tr, created_at, updated_at) VALUES ('Laksa','en',?,'Less chilli','en',?,?,?)", J({ my: "MY laksa" }), J({ my: "MY less" }), t, t).id;
// already in Chinese: must not be asked again or overwritten
const done = run("INSERT INTO entries (section, title, body, lang, tr, created_at, updated_at) VALUES ('rules','Shoes','Off inside','en',?,?,?)", J({ title: { my: "m", zh: "鞋" }, body: { my: "m", zh: "脱" } }), t, t).id;

test("a new household language is back-filled once, keeping every stored translation", async () => {
  syncHouseholdLangs();
  await kickBackfill();
  run("UPDATE household_langs SET backfilled_at = 1"); // en and my were done before 5.3
  asked.length = 0;

  // a second employer joins reading Chinese, a language the household has not used
  run("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES ('mei','Mei','x','employer',0,'zh',?)", t);
  await kickBackfill();
  const e = JSON.parse(one<{ tr: string }>("SELECT tr FROM entries WHERE id = ?", entry)!.tr);
  assert.deepEqual(e.title, { my: "MY gate", zh: "[zh] Gate" });
  assert.deepEqual(e.body, { my: "MY lock", zh: "[zh] Lock it" });
  assert.deepEqual(e.steps, [{ my: "MY step", zh: "[zh] Turn the key" }]);
  assert.deepEqual(JSON.parse(one<{ tr: string }>("SELECT tr FROM tasks WHERE id = ?", task)!.tr).title, { my: "MY mop", zh: "[zh] Mop" });
  const d = one<{ tr: string; note_tr: string }>("SELECT tr, note_tr FROM dishes WHERE id = ?", dish)!;
  assert.deepEqual(JSON.parse(d.tr), { my: "MY laksa", zh: "[zh] Laksa" });
  assert.deepEqual(JSON.parse(d.note_tr), { my: "MY less", zh: "[zh] Less chilli" });
  assert.deepEqual(JSON.parse(one<{ tr: string }>("SELECT tr FROM entries WHERE id = ?", done)!.tr).title, { my: "m", zh: "鞋" });
  assert.ok(asked.every((l) => l.join() === "zh"), `only Chinese asked: ${J(asked)}`);
  assert.equal(asked.length, 4); // entry, task, dish name, dish note — not the entry already done
  assert.ok(one("SELECT backfilled_at FROM household_langs WHERE lang = 'zh' AND backfilled_at IS NOT NULL"));

  // running again (a restart) asks nothing more
  asked.length = 0;
  run("UPDATE household_langs SET backfilled_at = NULL WHERE lang = 'zh'");
  await kickBackfill();
  assert.equal(asked.length, 0);
});

test("new texts go only into the household's languages", async () => {
  const tr = await translateAll("Good morning", "en");
  assert.deepEqual(Object.keys(tr).sort(), ["en", "my", "zh"]);
  run("UPDATE users SET removed_at = 1 WHERE login = 'mei'");
  assert.deepEqual(Object.keys(await translateAll("Good night", "en")).sort(), ["en", "my"]);
});

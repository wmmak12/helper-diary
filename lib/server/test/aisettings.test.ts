// AI settings (5.3): only the owner reads or changes them, they are saved even when the check fails, and a saved key
// never comes back in full from any response.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDataDir } from "./setup.ts";

freshDataDir();
const { NextRequest } = await import("next/server");
const { run } = await import("../db.ts");
const { createSession, SESSION_COOKIE } = await import("../auth.ts");
const settings = await import("../../../app/api/ai-settings/route.ts");
const me = await import("../../../app/api/me/route.ts");
const { textConfig, speechConfig, transcribeWith, silentWav } = await import("../aisettings.ts");

const KEY = "sk-test-0123456789abcdefWXYZ";
const SPEECH_KEY = "sk-speech-abcdefghijklmn9876";
const owner = run("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES ('owner@example.test','Owner','x','employer',1,'en',?)", Date.now()).id;
const other = run("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES ('mei','Mei','x','employer',0,'zh',?)", Date.now()).id;
const helper = run("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES ('mya','Mya','x','helper',0,'my',?)", Date.now()).id;

function req(userId: number | null, method = "GET", body?: unknown) {
  const headers: Record<string, string> = { host: "app.test", origin: "http://app.test", "content-type": "application/json" };
  if (userId) headers.cookie = `${SESSION_COOKIE}=${createSession(userId).token}`;
  return new NextRequest("http://app.test/api/ai-settings", { method, headers, body: body ? JSON.stringify(body) : undefined });
}
const ctx = { params: Promise.resolve({}) };

test("everyone but the owner is refused, with no settings data", async () => {
  for (const [who, status] of [[null, 401], [other, 403], [helper, 403]] as const) {
    for (const method of ["GET", "PUT"]) {
      const res = await (method === "GET" ? settings.GET : settings.PUT)(req(who, method, method === "PUT" ? { text: { base_url: "http://x", model: "m", key: "k" } } : undefined), ctx);
      assert.equal(res.status, status);
      const b = await res.json();
      assert.equal(b.settings, undefined);
    }
  }
  assert.equal(textConfig(), null); // nothing was saved by them
});

test("owner saves even when the check fails; the key never comes back in full", async () => {
  // a closed local port: the check fails fast with "unreachable", no network
  const put = await settings.PUT(
    req(owner, "PUT", { text: { base_url: "http://127.0.0.1:9/v1", model: "chat-model", key: KEY }, speech: { base_url: "http://127.0.0.1:9/v1", model: "whisper-1", key: SPEECH_KEY } }),
    ctx,
  );
  assert.equal(put.status, 200);
  const saved = await put.json();
  assert.equal(saved.check.text.ok, false);
  assert.equal(saved.check.text.error, "unreachable");
  assert.equal(saved.check.speech.error, "unreachable");
  assert.equal(saved.settings.text.key_hint, "…WXYZ");
  assert.equal(saved.settings.text_source, "owner");
  assert.equal(textConfig()?.apiKey, KEY);
  assert.equal(speechConfig()?.model, "whisper-1");

  // omitting the key keeps it; the model changes
  const put2 = await settings.PUT(req(owner, "PUT", { text: { base_url: "http://127.0.0.1:9/v1", model: "other-model" } }), ctx);
  const saved2 = await put2.json();
  assert.equal(textConfig()?.apiKey, KEY);
  assert.equal(saved2.settings.text.model, "other-model");

  const get = await (await settings.GET(req(owner), ctx)).text();
  const meRes = await (await me.GET(req(owner), ctx)).text();
  for (const out of [JSON.stringify(saved), JSON.stringify(saved2), get, meRes]) {
    assert.ok(!out.includes(KEY) && !out.includes(KEY.slice(0, 12)), "text key leaked");
    assert.ok(!out.includes(SPEECH_KEY) && !out.includes(SPEECH_KEY.slice(0, 12)), "speech key leaked");
  }
  assert.equal(JSON.parse(meRes).me.speech, true);
});

test("speech goes to OpenAI-style /audio/transcriptions, or to DeepSeek's /tools/asr with only the file", async () => {
  const sent: { url: string; fields: string[] }[] = [];
  const f = (async (url: URL, init: RequestInit) => {
    sent.push({ url: String(url), fields: [...(init.body as FormData).keys()] });
    return new Response("{}");
  }) as unknown as typeof fetch;
  await transcribeWith({ baseURL: "https://api.example.test/v1/", apiKey: "k", model: "whisper-1" }, silentWav(), { language: "en" }, f);
  await transcribeWith({ baseURL: "https://api.example.test/v1/tools/asr", apiKey: "k", model: "asr" }, silentWav(), { language: "en" }, f);
  await transcribeWith({ baseURL: "https://api.example.test/v1/tools/asr/", apiKey: "k", model: "asr" }, silentWav(), {}, f);
  assert.deepEqual(sent, [
    { url: "https://api.example.test/v1/audio/transcriptions", fields: ["file", "model", "language"] },
    { url: "https://api.example.test/v1/tools/asr", fields: ["file"] },
    { url: "https://api.example.test/v1/tools/asr", fields: ["file"] },
  ]);
});

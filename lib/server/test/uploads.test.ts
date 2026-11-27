// Uploads (photos, recordings) are read through formBody(): one past the limit is refused while it arrives, so a
// member cannot make the server hold a huge body in memory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { freshDataDir } from "./setup.ts";

freshDataDir();
const { NextRequest } = await import("next/server");
const { run } = await import("../db.ts");
const { createSession, SESSION_COOKIE } = await import("../auth.ts");
const { MAX_UPLOAD } = await import("../api.ts");
const photos = await import("../../../app/api/photos/route.ts");

const helper = run("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES ('mya','Mya','x','helper',0,'my',?)", Date.now()).id;
const ctx = { params: Promise.resolve({}) };
const CHUNK = 64 * 1024;

function upload(body: BodyInit | ReadableStream<Uint8Array>, headers: Record<string, string> = {}) {
  return new NextRequest("http://app.test/api/photos", {
    method: "POST",
    headers: { host: "app.test", origin: "http://app.test", cookie: `${SESSION_COOKIE}=${createSession(helper).token}`, ...headers },
    body: body as BodyInit,
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
}

/** A body of `total` bytes sent without a length, counting how much of it the server pulled. */
function stream(total: number) {
  const seen = { bytes: 0 };
  const s = new ReadableStream<Uint8Array>({
    pull(c) {
      if (seen.bytes >= total) return c.close();
      seen.bytes += CHUNK;
      c.enqueue(new Uint8Array(CHUNK));
    },
  });
  return { s, seen };
}

test("an upload past the limit is refused while it arrives, not after it is all in memory", async () => {
  const { s, seen } = stream(200 * 1024 * 1024);
  const res = await photos.POST(upload(s, { "content-type": "multipart/form-data; boundary=x" }), ctx);
  assert.equal(res.status, 413);
  assert.ok(seen.bytes <= MAX_UPLOAD + 2 * CHUNK, `read ${seen.bytes} bytes of 200 MB`);
});

test("an upload that declares a length past the limit is refused before any of it is read", async () => {
  const { s, seen } = stream(200 * 1024 * 1024);
  const res = await photos.POST(upload(s, { "content-type": "multipart/form-data; boundary=x", "content-length": String(200 * 1024 * 1024) }), ctx);
  assert.equal(res.status, 413);
  assert.ok(seen.bytes <= 2 * CHUNK, `read ${seen.bytes} bytes`);
});

test("a photo under the limit still saves, and a body that is not a form is a 400", async () => {
  const form = new FormData();
  form.set("photo", new File([new Uint8Array(1024)], "dish.png", { type: "image/png" }));
  const ok = await photos.POST(upload(form), ctx);
  assert.equal(ok.status, 201);
  assert.match((await ok.json()).id, /^[A-Za-z0-9_-]{16}$/);
  const bad = await photos.POST(upload("not a form", { "content-type": "text/plain" }), ctx);
  assert.equal(bad.status, 400);
});

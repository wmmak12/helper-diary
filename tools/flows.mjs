// One pass over the main flows against the built app (headless, 390 wide). Output under /tmp only.
// Usage: pnpm build && pnpm release && node tools/flows.mjs
// Playwright comes from PLAYWRIGHT (a module path), else the first *_PLAYWRIGHT variable set, else the "playwright" package.
const pw = process.env.PLAYWRIGHT || Object.entries(process.env).find(([k]) => k.endsWith("_PLAYWRIGHT"))?.[1] || "playwright";
const { chromium } = await import(pw);
import { start, signIn, FIXTURE } from "../scripts/review-session.mjs";

let s = await start();
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];
async function flow(name, who, fn, width = 390, height = 844, noRecorder = false, ctxOpts = {}, init = null, realSpeech = false) {
  // FLOWS_ONLY=<text> walks only the flows whose name contains it
  if (process.env.FLOWS_ONLY && !name.includes(process.env.FLOWS_ONLY)) return;
  const ctx = await browser.newContext({ viewport: { width, height }, ...ctxOpts });
  const tag = Math.random().toString(36).slice(2, 6);
  await ctx.addInitScript(`window.__tag = ${JSON.stringify(tag)};`);
  await ctx.addInitScript(fakeMic);
  if (init) await ctx.addInitScript(init);
  // a browser that cannot record
  if (noRecorder) await ctx.addInitScript(() => Object.defineProperty(window, "MediaRecorder", { value: undefined, configurable: true }));
  // /api/listen answered here (1.9): each heard hold gets the next numbered words; the talk id it sent is kept
  let heard = 0;
  ctx.listens = [];
  await ctx.route("**/api/listen", (route) => {
    const form = route.request().postDataBuffer()?.toString("latin1") ?? "";
    const field = (k) => new RegExp(`name="${k}"\\r\\n\\r\\n([^\\r]*)`).exec(form)?.[1] ?? null;
    ctx.listens.push({ lang: field("lang"), talkId: field("talkId"), wav: /filename="hold.wav"\r\nContent-Type: audio\/wav\r\n\r\nRIFF/.test(form) });
    route.fulfill({ json: { text: `${tag} words in ${field("lang") === "zh" ? "zh-CN" : "en-US"} ${++heard}` } });
  });
  // 5.3: Hold to talk shows only with the owner's speech settings. /api/listen is answered above, so flows that hold
  // get dummy speech settings saved; realSpeech flows start with none and set their own
  await setSpeech(!realSpeech);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
  try {
    await signIn(page, who, s.origin);
    await fn(page);
    results.push(`PASS ${name}`);
  } catch (e) {
    const st = await page.evaluate(() => JSON.stringify(window.__mic ?? null)).catch(() => "");
    results.push(`FAIL ${name}: ${e.message.split("\n")[0]} ${process.env.FLOWS_DEBUG ? st : ""}`);
    await page.screenshot({ path: `/tmp/flow-${name.replace(/\W+/g, "-")}.png`, fullPage: true }).catch(() => {});
  }
  await ctx.close();
}

// the owner's speech settings, set through the real API with one admin session per server (sign-in is rate limited)
let admin = { origin: null, cookie: "", speech: null };
async function setSpeech(on) {
  if (admin.origin !== s.origin) {
    const r = await fetch(`${s.origin}/api/session`, { method: "POST", headers: { "content-type": "application/json", origin: s.origin }, body: JSON.stringify({ login: FIXTURE.email, password: FIXTURE.password }) });
    if (!r.ok) throw new Error(`admin sign-in for speech settings: ${r.status}`);
    admin = { origin: s.origin, cookie: r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), speech: null };
  }
  if (admin.speech === on) return;
  const speech = on ? { base_url: "http://127.0.0.1:9/v1", model: "flow-model", key: "flow-key-0000" } : { base_url: "", model: "", key: "" };
  const r = await fetch(`${s.origin}/api/ai-settings`, { method: "PUT", headers: { "content-type": "application/json", origin: s.origin, cookie: admin.cookie }, body: JSON.stringify({ speech }) });
  if (!r.ok) throw new Error(`speech settings: ${r.status}`);
  // a realSpeech flow may save its own, so its state is unknown afterwards
  admin.speech = on ? true : null;
}

const barLabels = (p) => p.locator("[data-tabbar] a").evaluateAll((as) => as.map((a) => [...a.querySelectorAll("span[lang]")].map((x) => x.textContent.trim()).join("")));

// 1.6: the box at the top of Talk's controls is the main way to talk (the phone keyboard's mic key or typing).
async function sendThroughBox(p, text) {
  const box = p.locator("textarea[data-talk-box]");
  await box.click();
  await box.fill(text);
  await p.locator("form:has(textarea[data-talk-box]) button[type=submit]").dblclick(); // two quick taps: one line
  if ((await box.inputValue()) !== "") throw new Error("box not emptied after Send");
  if (await box.evaluate((el) => el === document.activeElement)) throw new Error("box still focused (keyboard up) after Send");
  await p.locator("ol li").filter({ hasText: text }).first().waitFor();
  const n = await p.locator("ol li").filter({ hasText: text }).count();
  if (n !== 1) throw new Error(`Send added the line ${n} times`);
}

await flow("employer lands on Talk and sends a line through the box", "admin", async (p) => {
  if (!p.url().endsWith("/talk")) throw new Error("landed on " + p.url());
  await p.getByText("Hold to talk").first().waitFor();
  await p.getByText("Tap the mic key on your keyboard to speak").waitFor();
  if (await p.getByRole("button", { name: /Type in English/ }).count()) throw new Error("Type in English is still on Talk");
  await p.locator("ol li").first().waitFor(); // the seeded talk has loaded before counting its lines
  const before = await p.locator("ol li").count();
  await p.locator("textarea[data-talk-box]").fill("   ");
  await p.locator("form:has(textarea[data-talk-box]) button[type=submit]").click({ force: true }); // looks disabled, stays tappable
  await p.waitForTimeout(300);
  if ((await p.locator("ol li").count()) !== before) throw new Error("a blank box added a line");
  await sendThroughBox(p, "Please bathe him at seven");
  await p.locator('[lang="my"]', { hasText: /ရေ/ }).first().waitFor({ timeout: 40000 });
  // 5.0: the employer's bar reads Talk, Kitchen, Notebook, Today, Calendar
  const labels = await barLabels(p);
  if (labels.join("|") !== "Talk|Kitchen|Notebook|Today|Calendar") throw new Error("bar: " + labels.join("|"));
  // 5.2: History is a full-width Past talks row under the controls, above today's lines, with the drafts count
  if (await p.locator("main [data-history-button]").count()) throw new Error("small History button still beside the title");
  const row = p.locator("main [data-past-talks]");
  const [rb, helperBtn, firstLine] = await Promise.all([row.boundingBox(), p.getByRole("button", { name: /replies/ }).boundingBox(), p.locator("ol li").first().boundingBox()]);
  if (!(rb.y > helperBtn.y && rb.y < firstLine.y)) throw new Error("Past talks is not between the controls and the lines");
  if (rb.width < 300) throw new Error("Past talks is not full width: " + rb.width);
  const drafts = (await p.evaluate(async () => (await (await fetch("/api/badges")).json()).drafts));
  const shown = (await row.textContent()).replace(/\D/g, "");
  if (drafts > 0 ? shown !== String(drafts) : shown !== "") throw new Error(`Past talks shows "${shown}", drafts ${drafts}`);
  await row.click();
  await p.waitForURL(/\/talks$/);
  await p.getByRole("heading", { name: "History" }).first().waitFor();
  await p.waitForFunction(() => document.title.startsWith("History"));
  // the screen History was opened from stays current in the bar
  const cur = await p.locator("[data-tabbar] a[aria-current=page]").textContent();
  if (!cur.includes("Talk")) throw new Error("current tab on History: " + cur);
});

// 1.9: a microphone and recorder for headless Chromium. Every hold "records" a few bytes; with
// window.__silentNext = true the next hold records nothing (the employer says nothing). /api/listen is answered by
// the flow itself (listenStub in flow()): "<tag> words in <en-US|zh-CN> <n>", so no speech-to-text key is needed here.
function fakeMic() {
  window.__mic = { open: 0, opened: 0 };
  navigator.mediaDevices.getUserMedia = async () => {
    window.__mic.open++;
    window.__mic.opened++;
    const track = { stop: () => track.live && ((track.live = false), window.__mic.open--), live: true };
    return { getTracks: () => [track] };
  };
  class FakeRecorder {
    constructor() {
      this.state = "inactive";
      this.mimeType = "audio/mp4";
    }
    static isTypeSupported(m) {
      return m === "audio/mp4";
    }
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      const silent = window.__silentNext;
      window.__silentNext = false;
      if (!silent) this.ondataavailable?.({ data: new Blob(["fake audio"], { type: "audio/mp4" }) });
      setTimeout(() => this.onstop?.(), 20);
    }
  }
  Object.defineProperty(window, "MediaRecorder", { value: FakeRecorder, configurable: true });
  // the fake recording is not real audio: decoding it gives a second of silence, which toWav turns into a WAV
  const RealOffline = window.OfflineAudioContext;
  window.OfflineAudioContext = class extends RealOffline {
    async decodeAudioData() {
      return { getChannelData: () => new Float32Array(16000) };
    }
  };
}
async function hold(p, expect, quick = false) {
  if (!quick) await p.waitForLoadState("networkidle").catch(() => {});
  await p.waitForTimeout(quick ? 450 : 300); // let late banners and the scroll to the new line settle before aiming
  const b = await p.getByRole("button", { name: /Hold to talk|按住说话/ }).boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await p.mouse.down();
  await p.getByText(/Listening · let go to send|正在听 · 松开发送/).first().waitFor({ timeout: 6000 });
  await p.waitForTimeout(500); // a real hold, past the 400ms too-short guard
  await p.mouse.up();
  if (expect) await p.getByText(expect).first().waitFor({ timeout: 6000 });
}

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
// Five holds in a row in one talk, each started as soon as the previous line shows (still translating), then a
// silent hold and a spoken one. Every spoken hold must become its line and a Burmese line; the mic is closed after
// each hold, and every hold after the first sends the talk's id so the server can use the talk as context (1.9).
for (const [browserName, ua, who] of [["Safari", IPHONE_UA, "mei"], ["Chrome", IPHONE_CHROME_UA, "mei"]]) {
  await flow(`iPhone ${browserName}: five holds in a row in one talk, a silent hold, then another`, who, async (p) => {
    await p.getByRole("button", { name: /Hold to talk|按住说话/ }).waitFor();
    const english = p.getByRole("radio", { name: "English" });
    if ((await english.getAttribute("aria-checked")) !== "true") await english.click();
    const tag = await p.evaluate(() => window.__tag);
    const said = (n) => new RegExp(`${tag} words in en-US ${n}\\b`);
    const lineShows = (n) => p.waitForFunction((w) => [...document.querySelectorAll("ol li p")].some((x) => x.textContent.trim() === w), `${tag} words in en-US ${n}`, { timeout: 4000 });
    let step = "hold 1";
    try {
    await hold(p, said(1));
    step = "line 1 shows";
    for (let n = 2; n <= 5; n++) {
      await lineShows(n - 1);
      step = `hold ${n}`;
      await hold(p, said(n), true); // started as soon as the previous line shows, while it translates
    }
    await lineShows(5);
    await p.waitForTimeout(2000);
    await p.evaluate(() => (window.__silentNext = true));
    step = "silent hold";
    await hold(p, null, true);
    await p.getByText("Nothing was heard. Hold the button and speak again.").waitFor({ timeout: 4000 });
    await hold(p, said(6), true);
    step = "hold 6";
    for (let n = 1; n <= 6; n++) {
      step = `translated ${n}`;
      const want = `${tag} words in en-US ${n}`;
      await p.waitForFunction((w) => [...document.querySelectorAll("ol li")].some((li) => [...li.querySelectorAll("*")].some((x) => new RegExp(`^${w}(?!\\d)`).test(x.textContent.trim())) && /[\u1000-\u109F]/.test(li.textContent)), want, { timeout: 40000 });
    }
    } catch (e) {
      throw new Error(`${step}: ${e.message.split("\n")[0]}`);
    }
    const mic = await p.evaluate(() => window.__mic);
    if (mic.open !== 0 || mic.opened !== 7) throw new Error("mic after the holds: " + JSON.stringify(mic));
    const listens = p.context().listens;
    if (listens.length !== 6 || listens.slice(1).some((x) => !x.talkId) || listens.some((x) => x.lang !== "en" || !x.wav)) throw new Error("listens: " + JSON.stringify(listens));
  }, 390, 844, false, { userAgent: ua });
}
// 1.4: every hold sends the server a silent record the team reads with scripts/hold-records.mjs (nothing on screen)
await flow("second hold in a talk: Listening once the mic opens, and a record reaches the server", "mei", async (p) => {
  const sent = [];
  p.on("response", async (r) => {
    if (r.url().endsWith("/api/holds")) sent.push({ status: r.status(), body: JSON.parse(r.request().postData() ?? "{}") });
  });
  await p.getByRole("button", { name: /Hold to talk|按住说话/ }).waitFor();
  await hold(p, /words in zh-CN 1/);
  await p.waitForTimeout(2200);
  await hold(p, /words in zh-CN 2/);
  await p.waitForTimeout(2500);
  const holds = sent.filter((x) => x.body.kind === "hold");
  if (!sent.some((x) => x.body.kind === "pageLoad")) throw new Error("no page-load record");
  if (holds.length < 2) throw new Error(`only ${holds.length} hold records sent`);
  const h2 = holds[1];
  if (h2.status !== 201) throw new Error(`hold record answered ${h2.status}`);
  const types = h2.body.events.map((e) => e.type);
  for (const t of ["call:getUserMedia", "micOpen", "listening", "recorded", "heard"]) if (!types.includes(t)) throw new Error(`hold 2 record lacks ${t}: ${types.join(",")}`);
  if (h2.body.outcome !== "sent" || h2.body.lang !== "zh" || !/iPhone/.test(h2.body.ua)) throw new Error("hold 2 record: " + JSON.stringify(h2.body).slice(0, 200));
  if (types.indexOf("listening") < types.indexOf("micOpen")) throw new Error("Listening before the mic opened");
  if (await p.getByText(/hold record|debug|\blogs?\b|日志/i).count()) throw new Error("something about the reporting is on screen");
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync("node", ["scripts/hold-records.mjs", "--user", "mei"], { env: { ...process.env, DATA_DIR: s.dataDir }, encoding: "utf8" });
  if ((out.match(/HOLD zh/g) ?? []).length < 2 || !/#1 listening/.test(out)) throw new Error("team's reader: " + out.slice(-300));
}, 390, 844, false, { userAgent: IPHONE_UA });
// 5.3: the owner-only reader GET /api/holds is gone; holds are still posted silently
await flow("5.3 GET /api/holds no longer exists, even for the owner", "admin", async (p) => {
  const st = await p.evaluate(async () => { const r = await fetch("/api/holds"); return [r.status, await r.text()]; });
  if (st[0] === 200 || st[1].includes("records")) throw new Error(`owner got ${st[0]}`);
}, 390, 844);
// 5.3: Hold to talk needs the owner's speech settings; without them the owner sees one line leading to Settings#ai
await flow("5.3 without speech settings: no Hold to talk, the box stays, the owner's line opens Settings at AI", "admin", async (p) => {
  await p.locator("textarea[data-talk-box]").waitFor();
  if (await p.getByRole("button", { name: /Hold to talk/ }).count()) throw new Error("Hold to talk shown without speech settings");
  await p.getByRole("link", { name: /Set up/ }).first().click();
  await p.waitForURL(/\/settings/);
  await p.getByText(/Text AI/).first().waitFor();
  await p.waitForTimeout(800); // the page transition settles
  const n = await p.locator("[id=ai]").count();
  if (n !== 1) throw new Error(`${n} elements with id ai`);
}, 390, 844, false, {}, null, true);

// 5.3: the owner saves speech settings; the check says what went wrong; the key shows only as its hint, after a reload too
await flow("5.3 owner saves speech settings: check result, key shown only as a hint, kept after reload", "admin", async (p) => {
  await p.goto(`${s.origin}/settings#ai`);
  const part = p.locator("[data-ai-part=speech]");
  await part.getByLabel(/^Address/).fill("http://127.0.0.1:9/v1");
  await part.getByLabel(/^Key/).fill("flow-secret-key-9z9z");
  await part.getByLabel(/^Model/).fill("flow-model");
  const put = p.waitForResponse((r) => r.url().endsWith("/api/ai-settings") && r.request().method() === "PUT");
  await p.getByRole("button", { name: "Save and check" }).click();
  const body = await (await put).text();
  if (body.includes("flow-secret-key")) throw new Error("PUT answer carries the key");
  await p.getByText(/Saved, but the address couldn't be reached/).first().waitFor();
  await p.reload();
  await p.getByText(/Key saved \(…9z9z\)/).first().waitFor();
  if ((await p.content()).includes("flow-secret-key")) throw new Error("the page holds the key");
  if (await p.evaluate(async () => (await (await fetch("/api/me")).text()).includes("flow-secret-key"))) throw new Error("/api/me carries the key");
  await p.goto(`${s.origin}/talk`);
  await p.getByRole("button", { name: /Hold to talk/ }).waitFor();
}, 390, 844, false, {}, null, true);
await flow("5.3 an employer who is not the owner sees no AI section and is refused by the API", "mei", async (p) => {
  await p.goto(`${s.origin}/settings`);
  await p.waitForTimeout(1500);
  if (await p.locator("[id=ai]").count()) throw new Error("AI section shown to mei");
  const st = await p.evaluate(async () => { const r = await fetch("/api/ai-settings"); return [r.status, await r.text()]; });
  if (st[0] !== 403 || st[1].includes("base_url")) throw new Error(`mei got ${st[0]}`);
}, 390, 844, false, {}, null, true);

if (process.env.FLOWS_ONLY === "iphone") {
  console.log(results.join("\n"));
  if (errors.length) console.log("Errors:\n" + [...new Set(errors)].slice(0, 15).join("\n"));
  await browser.close();
  await s.stop();
  process.exit(0);
}

await flow("every hold shows words, through 中文 / English switches", "mei", async (p) => {
  await hold(p, /words in zh-CN 1/);
  await p.waitForTimeout(1700); // past the release wait, while the line is translated
  await hold(p, /words in zh-CN 2/);
  await p.waitForTimeout(1700);
  await p.getByRole("radio", { name: "English" }).click();
  await hold(p, /words in en-US 3/);
  await p.waitForTimeout(1700);
  await p.getByRole("radio", { name: "中文" }).click();
  await hold(p, /words in zh-CN 4/);
  if (await p.getByText(/又被询问了/).count()) throw new Error("mic tip shown outside iPhone Safari");
  if (await p.getByText(/朗读|此设备没有该语言的语音/).count()) throw new Error("read-aloud still on Talk");
}, 390, 844);

await flow("iPhone Safari asks for the mic again after a reload: one closable line says how to stop it", "mei", async (p) => {
  await hold(p, /words in zh-CN 1/);
  await p.getByText(/又被询问了？在 Safari 点 aA/).waitFor();
  await p.getByRole("button", { name: "关闭" }).first().click();
  await p.reload();
  await hold(p, /words in zh-CN 1/);
  await p.waitForTimeout(400);
  if (await p.getByText(/又被询问了/).count()) throw new Error("closed tip came back");
}, 390, 844, false, { userAgent: IPHONE_UA }, {
  content: `localStorage.setItem("dt.mic.granted", "1"); navigator.permissions.query = async () => ({ state: "prompt" });`,
});

await flow("phone Talk: the talk's auto-added entry heads the list, opens the entry with its mark", "admin", async (p) => {
  const auto = p.getByRole("link", { name: /Cough syrup: 5 ml at 8 pm/ });
  await auto.waitFor();
  const [a, w, h] = await Promise.all([auto.boundingBox(), p.getByText(/drafts? waiting/).first().boundingBox(), p.getByRole("button", { name: /Hold to talk/ }).boundingBox()]);
  if (!(a.y < w.y)) throw new Error("auto-added entry is not above the waiting drafts");
  if (!(h.y < a.y)) throw new Error("list sits above Hold to talk");
  if (!(await auto.getByText("Already saved in the Notebook").count())) throw new Error("not marked already saved");
  await auto.click();
  await p.getByText("Auto-added from a talk").first().waitFor();
  await p.getByText("Snacks, dinner and bath time").first().waitFor();
  if (await p.getByText(/Read aloud/).count()) throw new Error("read-aloud on the entry");
  await p.goto(`${s.origin}/talks`);
  await p.getByText("Snacks, dinner and bath time").first().click();
  const [a2, d2] = await Promise.all([p.getByRole("link", { name: /Cough syrup/ }).first().boundingBox(), p.getByText("No snacks after 5 pm").first().boundingBox()]);
  if (!(a2.y < d2.y)) throw new Error("auto-added is not first in the talk's drafts");
});


await flow("helper: auto-added mark in Burmese; History opens a talk read-only; Notebook → My notes keeps Notebook current", "mya", async (p) => {
  await p.goto(`${s.origin}/notebook`);
  await p.getByText("စကားပြောမှ အလိုအလျောက် ထည့်ထားသည်").first().waitFor();
  // 1.4: History tab, read-only talk in Burmese
  const labels = await barLabels(p);
  // 5.0: Kitchen third in her bar; her History is a button at the top of Today
  if (labels.length !== 5 || labels[1] !== "ပြက္ခဒိန်" || labels[2] !== "မီးဖိုချောင်" || labels.includes("ပြောခဲ့သမျှ") || labels.includes("ကျွန်မ၏မှတ်စု")) throw new Error("bar: " + labels.join("|"));
  await p.goto(`${s.origin}/today`);
  await p.locator("main [data-history-button]").click();
  await p.waitForURL(/\/talks$/);
  await p.locator('a[href^="/talks/"]').first().click();
  await p.waitForURL(/\/talks\/\d+/);
  await p.locator("main [lang='my']").nth(2).waitFor();
  if (await p.getByRole("button", { name: /အတည်ပြု|ပယ်|ဖျက်/ }).count()) throw new Error("approve, drop or delete shown to her");
  if (await p.locator("main textarea, main [role=button]").count()) throw new Error("a line can be edited");
  // 5.0: opened from Today, so Today (first) stays current while she reads History
  if ((await p.locator("[data-tabbar] a").nth(0).getAttribute("aria-current")) !== "page") throw new Error("Today not kept current on History");
  const leak = await p.evaluate(async () => {
    const a = await (await fetch("/api/talks/latest")).json();
    const b = await (await fetch("/api/talks")).json();
    return (a.talk?.drafts?.length ?? 0) + a.waiting + b.talks.reduce((n, t) => n + t.waiting, 0);
  });
  if (leak) throw new Error("drafts reach the helper through the API");
  // 1.4: Notebook → My notes
  await p.locator("[data-tabbar] a", { hasText: "မှတ်စုစာအုပ်" }).click();
  await p.waitForURL(/\/notebook$/);
  await p.getByRole("tab", { name: "ကျွန်မ၏မှတ်စု" }).first().click();
  await p.waitForURL(/\/notes$/);
  const current = await p.locator("[data-tabbar] a[aria-current=page]").textContent();
  if (current.trim() !== "မှတ်စုစာအုပ်") throw new Error("current tab on My notes: " + current);
  await p.getByText("Leo ကြိုက်တဲ့ ကြက်သားဆန်ပြုတ်").first().waitFor();
  await p.locator("main button").filter({ hasText: "မှတ်စုအသစ်" }).first().click();
  await p.getByRole("dialog").locator("textarea, input").first().waitFor();
});


// 1.6: the box with Send on top, Hold to talk under it, her Burmese button alone at full width; labels follow the switch.
async function checkControls(p, micHint, helperLine) {
  const helper = p.getByRole("button", { name: helperLine }).first();
  await helper.waitFor();
  await p.getByText(micHint).waitFor();
  const [box, hold, hb] = await Promise.all([p.locator("textarea[data-talk-box]").boundingBox(), p.getByRole("button", { name: /Hold to talk|按住说话/ }).boundingBox(), helper.boundingBox()]);
  if (!(box.y < hold.y && hold.y < hb.y)) throw new Error("order is not box, Hold to talk, helper button");
  if (Math.abs(hb.width - hold.width) > 1) throw new Error(`helper button ${hb.width} wide vs Hold ${hold.width}`);
  if (await p.getByRole("button", { name: /Type in English|用中文打字/ }).count()) throw new Error("the employer typing button is still on Talk");
  const clipped = await helper.evaluate((el) => [...el.querySelectorAll("span")].some((s) => s.scrollWidth > s.clientWidth + 1 || s.getBoundingClientRect().right > el.getBoundingClientRect().right));
  if (clipped) throw new Error("helper button text is clipped");
}

await flow("Talk controls in 中文 then English, at 360 wide", "mei", async (p) => {
  await checkControls(p, "点键盘上的麦克风键说话", /Mya 回复/);
  await p.getByRole("radio", { name: "English" }).click();
  await checkControls(p, "Tap the mic key on your keyboard to speak", /Mya replies/);
  if ((await p.locator("textarea[data-talk-box]").getAttribute("lang")) !== "en") throw new Error("box language does not follow the switch");
  await p.getByRole("radio", { name: "中文" }).click();
  await checkControls(p, "点键盘上的麦克风键说话", /Mya 回复/);
}, 360, 740);

await flow("no recorder: the box is the main control, no Hold to talk, her button still types", "admin", async (p) => {
  await p.getByText(/This browser can't listen here/).waitFor();
  if (await p.getByRole("button", { name: /Hold to talk/ }).count()) throw new Error("Hold to talk shown without a recorder");
  if (await p.getByRole("button", { name: /Type in English/ }).count()) throw new Error("Type in English shown");
  await p.getByRole("button", { name: /Mya replies/ }).click();
  await p.getByRole("dialog").waitFor();
  await p.keyboard.press("Escape");
  await sendThroughBox(p, "Dinner at seven");
  await p.locator("ol li").first().locator('[lang="my"]').first().waitFor({ timeout: 40000 });
}, 390, 844, true);

await flow("short phone: the new line's Burmese shows above the tab bar", "mei", async (p) => {
  await sendThroughBox(p, "请七点给他洗澡");
  const my = p.locator("ol li").first().locator('[lang="my"]').last();
  await my.waitFor({ timeout: 40000 });
  await p.waitForTimeout(800);
  const box = await my.boundingBox();
  const nav = await p.locator("[data-tabbar]").boundingBox();
  if (!box || !nav || box.y + box.height > nav.y) throw new Error(`Burmese bottom ${box && box.y + box.height} vs tab bar ${nav && nav.y}`);
}, 390, 664);

await flow("helper replies on the app's Burmese keyboard", "admin", async (p) => {
  await p.getByRole("button", { name: /မြန်မာလို/ }).first().click();
  for (const ch of ["က", "ျ", "ေ", "း"]) await p.getByRole("button", { name: ch, exact: true }).first().click();
  const typed = await p.locator('[lang="my"]').filter({ hasText: "ကျေး" }).count();
  if (!typed) throw new Error("keyboard did not type ကျေး");
});

await flow("approve a contradicting draft (replace)", "admin", async (p) => {
  await p.goto(`${s.origin}/talks`);
  await p.getByText("Snacks, dinner and bath time").first().click();
  await p.getByText(/Replaces/).first().waitFor();
  const card = p.locator("article, li, div").filter({ hasText: /Replaces/ }).last();
  await card.getByRole("button", { name: /^Approve/ }).first().click();
  await p.getByRole("dialog").getByRole("button", { name: /^Replace/ }).click();
  await p.getByText("Added to the Notebook").first().waitFor({ timeout: 40000 });
});

await flow("helper lands on Today, sees the change, confirms it, ticks a task", "mya", async (p) => {
  if (!p.url().endsWith("/today")) throw new Error("landed on " + p.url());
  await p.locator('a[href^="/notebook/"]').first().click();
  await p.waitForURL(/\/notebook\/\d+/);
  await p.getByRole("button", { name: /နားလည်/ }).first().click();
  await p.getByText(/နားလည်ပြီး|နားလည်/).first().waitFor();
  await p.goto(`${s.origin}/today`);
  const box = p.getByRole("checkbox").nth(1);
  await box.click();
  await p.waitForTimeout(500);
  await p.reload();
  await p.locator('[role="checkbox"]').first().waitFor();
  const checked = await p.locator('[role="checkbox"][aria-checked="true"], input[type="checkbox"]:checked').count();
  if (checked < 2) throw new Error(`expected 2 ticked after reload, got ${checked}`);
});

await flow("helper asks a question; writes a private note", "mya", async (p) => {
  await p.goto(`${s.origin}/questions`);
  await p.getByRole("button", { name: /မေးခွန်းမေး/ }).first().click();
  await p.getByRole("dialog").locator("textarea").fill("မနက်ဖြန် ဈေးသွားရမလား။");
  await p.getByRole("dialog").getByRole("button", { name: /ပို့/ }).click();
  await p.getByText("မနက်ဖြန် ဈေးသွားရမလား။").first().waitFor({ timeout: 40000 });
  await p.goto(`${s.origin}/notes`);
  await p.getByText("Leo ကြိုက်တဲ့ ကြက်သားဆန်ပြုတ်").first().waitFor();
});

await flow("employer answers the question; settings invite", "mei", async (p) => {
  await p.goto(`${s.origin}/questions`);
  await p.locator("textarea").first().fill("不用，吹到半干就可以。");
  await p.locator("form").first().getByRole("button").last().click();
  await p.waitForTimeout(1500);
});

await flow("admin makes an invite", "admin", async (p) => {
  await p.goto(`${s.origin}/settings`);
  await p.getByRole("button", { name: /invite/i }).first().click();
  await p.getByText(/signup\?code=/).first().waitFor();
}, 1280);

await flow("desktop Talk (auto-added entry above the waiting drafts) and Notebook render", "admin", async (p) => {
  await p.getByText("Hold to talk").first().waitFor();
  const aside = p.locator("aside");
  await aside.getByRole("link", { name: /Cough syrup/ }).waitFor();
  const [a, w] = await Promise.all([aside.getByRole("link", { name: /Cough syrup/ }).boundingBox(), aside.getByText(/drafts? waiting/).boundingBox()]);
  if (!(a.y < w.y)) throw new Error("auto-added not first");
  await p.goto(`${s.origin}/notebook`);
  await p.getByText("Purpose").first().waitFor();
  await p.getByText("+65 9123 4567").first().waitFor();
}, 1280);


// ---- 5.1 one talk per day, and a bin on every row
await flow("5.1 Talk: no New talk; a bin on each row deletes it at once (text, photo, still translating); reload keeps it gone", "admin", async (p) => {
  const tag = await p.evaluate(() => window.__tag);
  await p.locator("ol li").first().waitFor(); // the seeded talk is today's
  if (await p.getByRole("button", { name: /New talk|新对话/ }).count()) throw new Error("New talk is still on Talk");
  if (await p.getByText(/Last talk/i).count()) throw new Error("Last talk heading shown");
  const before = await p.locator("ol li").count();
  const text = `Bin me ${tag}`;
  await sendThroughBox(p, text);
  const row = p.locator("ol li").filter({ hasText: text }).first();
  await row.locator('[lang="my"]').last().waitFor({ timeout: 40000 }); // translated
  // the bin: top right, level with the speaker line, which stays on one line
  const [bin, eyebrow, words] = await Promise.all([row.locator("[data-line-bin]").boundingBox(), row.locator("p.eyebrow").boundingBox(), row.locator("button[aria-label^='Correct']").boundingBox()]);
  if (!(bin.x + bin.width > 390 - 40 && Math.abs(bin.y + bin.height / 2 - (eyebrow.y + eyebrow.height / 2)) < 10)) throw new Error(`bin not level at the top right: ${JSON.stringify(bin)} ${JSON.stringify(eyebrow)}`);
  if (eyebrow.height > 30) throw new Error("speaker line wraps");
  if (bin.y + bin.height > words.y + 1) throw new Error("bin's tap area overlaps the words");
  if (bin.width < 44 || bin.height < 44) throw new Error("bin tap area too small");
  // tapping the words still opens Save correction
  await row.locator("button[aria-label^='Correct']").click();
  await p.getByRole("button", { name: "Save correction" }).waitFor();
  await p.getByRole("button", { name: "Cancel" }).click();
  await row.getByRole("button", { name: "Delete this line" }).click();
  await p.waitForTimeout(400);
  if (await p.locator("ol li").filter({ hasText: text }).count()) throw new Error("row still on screen after the bin");
  if (await p.getByText(/Couldn't delete/).count()) throw new Error("failure line on success");
  // a photo row
  await p.evaluate(async () => {
    const fd = new FormData();
    fd.append("photo", await (await fetch("/empty-kitchen.png")).blob(), "x.png");
    const ph = await (await fetch("/api/photos", { method: "POST", body: fd })).json();
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const t = await (await fetch(`/api/talks/today?start=${start}&end=${start + 86400000}`)).json();
    await fetch(`/api/talks/${t.talk.id}/photos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ photo: ph.id, speaker: "employer" }) });
  });
  await p.reload();
  const photoRow = p.locator("ol li").filter({ has: p.locator("img") }).first();
  await photoRow.waitFor();
  const photos = await p.locator("ol li img").count();
  await photoRow.getByRole("button", { name: "Delete this line" }).click();
  await p.waitForTimeout(400);
  if ((await p.locator("ol li img").count()) !== photos - 1) throw new Error("photo row not removed");
  // binned while still translating: it stays deleted when the translation comes back
  const late = `Late bin ${tag}`;
  const box = p.locator("textarea[data-talk-box]");
  await box.fill(late);
  await p.locator("form:has(textarea[data-talk-box]) button[type=submit]").click();
  await p.locator("ol li").filter({ hasText: late }).getByRole("button", { name: "Delete this line" }).click();
  await p.waitForTimeout(400);
  if (await p.locator("ol li").filter({ hasText: late }).count()) throw new Error("translating row stayed");
  await p.waitForTimeout(12000);
  if (await p.locator("ol li").filter({ hasText: late }).count()) throw new Error("translating row came back");
  await p.reload();
  await p.locator("ol li").first().waitFor();
  if (await p.locator("ol li").filter({ hasText: new RegExp(`${text}|${late}`) }).count()) throw new Error("a binned row is back after reload");
  if ((await p.locator("ol li").count()) !== before) throw new Error(`other rows changed: ${before} → ${await p.locator("ol li").count()}`);
  // notes made from the talk stay
  await p.getByRole("link", { name: /Cough syrup: 5 ml at 8 pm/ }).waitFor();
});

await flow("5.1 History: an employer bins every row of a talk; it leaves History and its URL lands on History", "admin", async (p) => {
  // a talk of its own (two photo rows, no model call), so the seeded talks other flows read stay
  const t = await p.evaluate(async () => {
    const fd = new FormData();
    fd.append("photo", await (await fetch("/empty-kitchen.png")).blob(), "x.png");
    const ph = await (await fetch("/api/photos", { method: "POST", body: fd })).json();
    const talk = (await (await fetch("/api/talks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: "en" }) })).json()).talk;
    for (let i = 0; i < 2; i++) await fetch(`/api/talks/${talk.id}/photos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ photo: ph.id, speaker: "employer" }) });
    return talk;
  });
  await p.goto(`${s.origin}/talks/${t.id}`);
  const bins = p.getByRole("button", { name: "Delete this line" });
  await bins.first().waitFor();
  while ((await bins.count()) > 1) {
    const n = await bins.count();
    await bins.first().click();
    await p.waitForFunction((k) => document.querySelectorAll("[data-line-bin]").length < k, n);
  }
  await bins.first().click();
  await p.waitForURL(/\/talks$/);
  await p.locator('a[href^="/talks/"]').first().waitFor();
  if (await p.locator(`a[href="/talks/${t.id}"]`).count()) throw new Error("emptied talk still in History");
  await p.goto(`${s.origin}/talks/${t.id}`);
  await p.waitForURL(/\/talks$/);
  // the History count is only drafts in talks History still lists
  const [badge, listed] = await p.evaluate(async () => [
    (await (await fetch("/api/badges")).json()).drafts,
    (await (await fetch("/api/talks")).json()).talks.reduce((n, x) => n + x.waiting, 0),
  ]);
  if (badge !== listed) throw new Error(`History count ${badge} but History lists ${listed} to review`);
  // tidy: the emptied talk would otherwise be today's talk for the flows after this one
  await p.evaluate((id) => fetch(`/api/talks/${id}`, { method: "DELETE" }), t.id);
});

await flow("5.1 helper: no bin in History and the server refuses her delete", "mya", async (p) => {
  await p.goto(`${s.origin}/talks`);
  await p.locator('a[href^="/talks/"]').first().click();
  await p.locator("main [lang='my']").nth(2).waitFor();
  if (await p.locator("[data-line-bin]").count()) throw new Error("bin shown to the helper");
  const st = await p.evaluate(async () => {
    const t = (await (await fetch("/api/talks")).json()).talks[0];
    const d = await (await fetch(`/api/talks/${t.id}`)).json();
    return (await fetch(`/api/lines/${d.talk.lines[0].id}`, { method: "DELETE" })).status;
  });
  if (st !== 403) throw new Error("helper delete answered " + st);
});

await flow("5.1 Talk on a new day: a blank page with the picture and one line; the first line starts the day's talk", "admin", async (p) => {
  const t = new Date();
  await p.clock.install({ time: new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 8, 0) });
  await p.goto(`${s.origin}/talk`);
  await p.getByRole("heading", { name: "Nothing has been said today yet" }).waitFor();
  if (await p.locator("ol li").count()) throw new Error("earlier rows on a new day");
  if (await p.getByText(/This talk|Last talk/).count()) throw new Error("a talk heading on a blank day");
  if (await p.getByRole("link", { name: /Cough syrup/ }).count()) throw new Error("yesterday's notes on a blank day");
  if (!(await p.locator('img[src="/empty-conversations.png"]').count())) throw new Error("no picture");
  if (!/\d/.test(await p.locator("main [data-past-talks]").textContent())) throw new Error("Past talks lost its drafts count");
  await sendThroughBox(p, "First thing tomorrow");
  await p.getByText("This talk", { exact: true }).waitFor();
});

// ---- 2.0 Calendar and day pages
const isoPlus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const addIso = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const clipped = (p) => p.locator("[data-tabbar] a span[lang]").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > window.innerWidth).map((e) => e.textContent));

await flow("calendar: employer opens month, switches to week (remembered), adds a weekly task on a date and moves one day", "admin", async (p) => {
  await p.locator("[data-tabbar] a", { hasText: "Calendar" }).click();
  await p.waitForURL(/\/calendar/);
  await p.locator('a[aria-current="date"]').first().waitFor();
  if ((await clipped(p)).length) throw new Error("clipped tab labels");
  await p.getByRole("button", { name: "Week", exact: true }).click();
  await p.locator("ul a[href^='/calendar/20']").nth(6).waitFor();
  await p.reload();
  await p.locator("ul a[href^='/calendar/20']").nth(6).waitFor(); // still the week view
  await p.getByRole("button", { name: "Month", exact: true }).click();
  const day = isoPlus(2);
  await p.goto(`${s.origin}/calendar/${day}`);
  await p.getByRole("button", { name: "Add" }).first().click();
  await p.locator('[role=dialog] input[required]').fill("Flow weekly task");
  await p.locator("[role=dialog]").getByRole("button", { name: "Weekly" }).click();
  await p.locator("[role=dialog]").getByRole("button", { name: "Save" }).click();
  await p.locator("li", { hasText: "Flow weekly task" }).first().waitFor();
  await p.locator("li", { hasText: "Flow weekly task" }).getByRole("button", { name: "Move" }).click();
  await p.locator("[role=dialog] input[type=date]").fill(isoPlus(3));
  await p.locator("[role=dialog]").getByRole("button", { name: "Move" }).click();
  await p.getByText(/^Moved to /).first().waitFor();
  await p.locator("li", { hasText: "Flow weekly task" }).first().waitFor({ state: "detached", timeout: 5000 }).catch(() => { throw new Error("moved task still on the old day"); });
  await p.goto(`${s.origin}/calendar/${isoPlus(9)}`);
  await p.locator("li", { hasText: "Flow weekly task" }).first().waitFor(); // the rest of the series stays
  await p.goto(`${s.origin}/calendar/${isoPlus(-3)}`);
  await p.getByText("Talks that day").waitFor();
  if (await p.getByRole("button", { name: "Add" }).count()) throw new Error("Add offered on a past date");
});

await flow("calendar: employer desktop month shows titles", "admin", async (p) => {
  await p.goto(`${s.origin}/calendar`);
  await p.locator('a[aria-current="date"] span.truncate').first().waitFor();
}, 1280, 900);

await flow("calendar: helper reads Calendar and a day page in Burmese with nothing to change; Today → Tomorrow and back", "mya", async (p) => {
  await p.getByRole("button", { name: "မနက်ဖြန်" }).click();
  await p.getByText("မနက်ဖြန် အလုပ်များ").waitFor();
  if (await p.locator('[role=checkbox]').count()) throw new Error("tick boxes on Tomorrow");
  await p.getByRole("button", { name: "ယနေ့သို့ ပြန်သွားရန်" }).click();
  await p.locator('[role=checkbox]').first().waitFor();
  if ((await clipped(p)).length) throw new Error("clipped Burmese tab labels");
  await p.locator("[data-tabbar] a", { hasText: "ပြက္ခဒိန်" }).click();
  await p.waitForURL(/\/calendar/);
  await p.locator('a[aria-current="date"]').first().click();
  await p.waitForURL(/\/calendar\/\d{4}-\d{2}-\d{2}/);
  await p.getByText("အလုပ်များ").first().waitFor();
  const controls = await p.locator("main button").evaluateAll((bs) => bs.map((b) => b.textContent.trim()).filter((x) => /ထည့်ရန်|ရွှေ့ရန်|ဖျက်ရန်|Add|Move|Delete/.test(x)));
  if (controls.length) throw new Error("helper sees " + controls.join(","));
});

await flow("talk: top bar is solid over the Questions banner when scrolled", "admin", async (p) => {
  const a = await p.locator("[data-topbar]").evaluate((h) => getComputedStyle(h).backgroundColor);
  if (/rgba\(.*,\s*0?\.\d+\)|\/\s*0?\.\d/.test(a)) throw new Error("top bar is see-through: " + a);
});

// 3.0 Task templates (FLOWS_ONLY=templates)
await flow("templates: employer opens Baby care from Calendar, edits and removes tasks, previews, puts it on the calendar, then removes its tasks", "admin", async (p) => {
  p.on("dialog", (d) => d.accept());
  await p.goto(`${s.origin}/calendar`);
  await p.getByRole("link", { name: "Templates" }).click();
  await p.waitForURL(/\/templates$/);
  for (const n of ["Daily cleaning", "Baby care", "Elderly care", "Laundry week", "Cooking", "A new helper's first week"]) await p.getByText(n, { exact: true }).waitFor();
  await p.getByText("周末大扫除").waitFor(); // the seeded template under My templates
  await p.getByText("Baby care", { exact: true }).click();
  await p.waitForURL(/\/templates\/sample-baby/);
  await p.locator("button[aria-label^='Edit task:']").first().click();
  const title = p.locator("[role=dialog] input").first();
  await title.fill("Flow bottles for Leo");
  await p.locator("[role=dialog] input[type=time]").fill("06:15");
  await p.locator("[role=dialog]").getByRole("button", { name: "Some days" }).click();
  await p.locator("[role=dialog]").getByRole("button", { name: "Done" }).click();
  await p.getByText("Flow bottles for Leo").waitFor();
  const before = await p.locator("button[aria-label^='Remove:']").count();
  await p.locator("button[aria-label^='Remove:']").last().click();
  await p.waitForFunction((n) => document.querySelectorAll("button[aria-label^='Remove:']").length === n, before - 1, { timeout: 5000 }).catch(() => { throw new Error("remove did not take the task out"); });
  await p.getByRole("button", { name: "Preview the first week" }).click();
  await p.getByText(/^First week from/).waitFor();
  const start = await p.locator("input[type=date]").inputValue();
  if (start <= isoPlus(0)) throw new Error("start date not after today: " + start);
  await p.getByRole("button", { name: "Put on calendar" }).click();
  await p.waitForURL(/\/calendar\?d=/);
  await p.getByText(/^Added \d+ tasks from Baby care/).first().waitFor();
  await p.getByText("Flow bottles for Leo").first().waitFor();
  await p.goto(`${s.origin}/calendar/${addIso(start, -1)}`);
  await p.getByText("Talks that day", { exact: true }).waitFor();
  if (await p.getByText("Flow bottles for Leo").count()) throw new Error("template task shows before its start date");
  await p.goto(`${s.origin}/templates/sample-baby`);
  await p.getByText(/^On the calendar from/).first().waitFor();
  await p.getByRole("button", { name: "Remove its tasks" }).click();
  await p.getByText(/^Took \d+ tasks off the calendar/).waitFor();
  await p.goto(`${s.origin}/calendar/${start}`);
  await p.getByText("Talks that day", { exact: true }).waitFor();
  if (await p.getByText("Flow bottles for Leo").count()) throw new Error("removed template task still on the calendar");
});

await flow("templates: save a sample as my template, save this week, both under My templates", "admin", async (p) => {
  await p.goto(`${s.origin}/templates/sample-cooking`);
  await p.getByRole("button", { name: "Save as my template" }).click();
  await p.locator("[role=dialog] input").fill("");
  await p.locator("[role=dialog]").getByRole("button", { name: "Save" }).click();
  await p.getByText("Type a name for the template.").waitFor();
  await p.locator("[role=dialog] input").fill("Flow cooking");
  await p.locator("[role=dialog]").getByRole("button", { name: "Save" }).click();
  await p.waitForURL(/\/templates\/mine-\d+/);
  await p.goto(`${s.origin}/calendar`);
  await p.getByRole("button", { name: "Week", exact: true }).click();
  await p.getByRole("button", { name: "Save this week as a template" }).click();
  await p.locator("[role=dialog]").getByRole("button", { name: "Save" }).click();
  await p.getByText(/^Saved “Week of/).waitFor();
  await p.goto(`${s.origin}/templates`);
  await p.getByText("Flow cooking").waitFor();
  await p.getByText(/^Week of/).first().waitFor();
});

await flow("templates: Mei sees the samples in 中文", "mei", async (p) => {
  await p.goto(`${s.origin}/templates`);
  await p.getByText("照顾宝宝").waitFor();
  await p.getByText("照顾宝宝").click();
  await p.getByRole("button", { name: "预览第一周" }).waitFor();
});

await flow("templates: the helper has no Templates button or screen", "mya", async (p) => {
  await p.goto(`${s.origin}/templates`);
  await p.waitForURL(/\/today/);
  await p.goto(`${s.origin}/calendar`);
  await p.locator('a[aria-current="date"]').first().waitFor();
  if (await p.locator("a[href='/templates']").count()) throw new Error("helper sees Templates");
});

// 4.0 AI template helper (FLOWS_ONLY=ai:). Two flows make real model calls (the AI_* values in the environment).
const aiCalls = (p) => { const n = { c: 0 }; p.on("request", (r) => r.method() === "POST" && /\/api\/template-chats/.test(r.url()) && n.c++); return n; };

await flow("ai: Calendar's entry says AI can write a routine; Templates opens on the chat; no Past chats; Change with AI opens the ask box focused", "admin", async (p) => {
  const calls = aiCalls(p);
  await p.goto(`${s.origin}/calendar`);
  await p.getByRole("link", { name: /AI can write a routine/ }).click();
  await p.waitForURL(/\/templates$/);
  await p.getByRole("heading", { name: "Samples" }).waitFor();
  await p.waitForTimeout(600); // the outgoing page's exit animation
  const [box, samples] = await Promise.all([p.locator("#tpl-ai-box").boundingBox(), p.getByRole("heading", { name: "Samples" }).boundingBox()]);
  if (!box || !samples || box.y > samples.y) throw new Error("chat box is not above Samples");
  await p.getByText(/^Using your household: 2 adults, Grandma 82, Leo 3, cat/).waitFor();
  if (await p.getByText("Past chats").count()) throw new Error("Past chats still on Templates");
  if (await p.locator('a[href^="/templates/chats/"]').count()) throw new Error("a link back to an old chat");
  const mine = p.locator("section[aria-labelledby=tpl-mine] li");
  const nMine = await mine.count();
  if (!nMine || (await p.getByRole("button", { name: "Change with AI" }).count()) !== nMine) throw new Error("not every My templates row has Change with AI");
  if (await p.locator("section[aria-labelledby=tpl-samples]").getByRole("button", { name: "Change with AI" }).count()) throw new Error("a sample has Change with AI");
  await mine.first().getByRole("button", { name: "Change with AI" }).click();
  await p.waitForURL(/\/templates\/mine-\d+$/);
  await p.waitForFunction(() => document.activeElement?.id === "tpl-ask-box");
  const ask = await p.locator("#tpl-ask-box").boundingBox();
  if (ask.y < 0 || ask.y + ask.height > 844) throw new Error("ask box not in view");
  await p.goBack();
  await mine.first().locator("a").click();
  await p.waitForURL(/\/templates\/mine-\d+$/);
  await p.waitForTimeout(300);
  if (await p.evaluate(() => document.activeElement?.id === "tpl-ask-box")) throw new Error("plain row tap focused the ask box");
  if (calls.c) throw new Error(`${calls.c} AI calls without a Send`);
});

await flow("ai: describe the home, get a proposal, fix a time on the card, accept it under My templates", "admin", async (p) => {
  await p.goto(`${s.origin}/templates`);
  await p.locator("textarea[data-ask-box]").fill("Plan a week for our helper. Two adults, Grandma who is 82, a 3-year-old and a cat in a three-bedroom flat; floors and Grandma's medicine matter most.");
  await p.getByRole("button", { name: "Send" }).click();
  await p.getByRole("button", { name: "Send" }).isDisabled().then((d) => { if (!d) throw new Error("Send not disabled while writing"); });
  await p.waitForURL(/\/templates\/chats\/\d+$/, { timeout: 90000 });
  if (!(await p.locator("[data-proposal]").count())) {
    // it asked one follow-up question: answer it once
    await p.waitForTimeout(600);
    await p.locator("#chat-box").fill("Grandma takes medicine at 8 am and 8 pm; no other pets, no garden.");
    await p.getByRole("button", { name: "Send" }).click();
  }
  const card = p.locator("[data-proposal]");
  await card.waitFor({ timeout: 90000 });
  const titles = (await card.locator("li span.font-medium").allTextContents()).join(" | ");
  if (/\b(baby|bottle|dog|garden|lawn)\b/i.test(titles)) throw new Error("proposal does not fit the home: " + titles);
  if (!/grandma/i.test(titles) || !/cat|litter/i.test(titles)) throw new Error("proposal misses Grandma or the cat: " + titles);
  await card.locator("button[aria-label^='Edit task:']").first().click();
  await p.locator("[role=dialog] input[type=time]").fill("06:40");
  await p.locator("[role=dialog]").getByRole("button", { name: "Done" }).click();
  await card.getByText("06:40").waitFor();
  await card.getByRole("button", { name: "Accept" }).click();
  await p.locator("[role=dialog] input").fill("Flow AI week");
  await p.locator("[role=dialog]").getByRole("button", { name: "Save" }).click();
  await p.waitForURL(/\/templates\/mine-\d+$/);
  await p.getByText("06:40").first().waitFor();
  await p.goto(`${s.origin}/templates`);
  await p.getByText("Flow AI week").waitFor();
});

await flow("ai: ask to change a sample, changes marked, accept saves a new template and the sample stays", "admin", async (p) => {
  await p.goto(`${s.origin}/templates/sample-laundry`);
  await p.locator("textarea[data-ask-box]").fill("No ironing, and move all the laundry to Saturday");
  await p.getByRole("button", { name: "Send" }).click();
  await p.waitForURL(/\/templates\/chats\/\d+$/, { timeout: 90000 });
  const card = p.locator("[data-proposal]");
  await card.waitFor();
  await card.getByText(/^changed: days/).first().waitFor();
  await card.getByText("removed").first().waitFor();
  await card.getByRole("button", { name: "Accept" }).click();
  await p.locator("[role=dialog]").getByRole("button", { name: "Save" }).click();
  await p.waitForURL(/\/templates\/mine-\d+$/);
  if (await p.getByText(/^Iron /).count()) throw new Error("ironing still in the accepted template");
  await p.goto(`${s.origin}/templates/sample-laundry`);
  await p.getByText(/^Iron /).first().waitFor();
});

await flow("ai: when the AI cannot be reached the chat says so and keeps the message", "admin", async (p) => {
  await p.route("**/api/template-chats", (r) => r.fulfill({ status: 503, json: { error: "ai_unavailable" } }));
  await p.goto(`${s.origin}/templates`);
  await p.locator("#tpl-ai-box").fill("No ironing please");
  await p.getByRole("button", { name: "Send" }).click();
  await p.getByText("The AI could not be reached. Your message is still here, so try again.").waitFor();
  if ((await p.locator("#tpl-ai-box").inputValue()) !== "No ironing please") throw new Error("typed message lost");
  if (await p.getByRole("button", { name: "Send" }).isDisabled()) throw new Error("cannot send again");
});

await flow("ai: Mei sees the chat in 中文 and the household page", "mei", async (p) => {
  await p.goto(`${s.origin}/templates`);
  await p.getByRole("heading", { name: "让 AI 写一份日程" }).waitFor();
  await p.getByRole("button", { name: "用 AI 修改" }).first().waitFor();
  await p.getByRole("link", { name: "你的家" }).first().click();
  await p.waitForURL(/\/templates\/household$/);
  if ((await p.locator("textarea").inputValue()).indexOf("Grandma") < 0) throw new Error("profile not shared with Mei");
});

await flow("ai 5.2: Your household says the helper never sees it and asks to list everyone; Save to Your household adds a new detail once", "admin", async (p) => {
  await p.goto(`${s.origin}/templates/household`);
  await p.getByText("Shared by both employers and used in every AI proposal. The helper never sees it.").waitFor();
  await p.getByText("List everyone who lives in the home, yourselves included.").waitFor();
  await p.goto(`${s.origin}/templates`);
  await p.locator("#tpl-ai-box").fill("We also have a goldfish now. Can you plan a light weekend routine?");
  await p.getByRole("button", { name: "Send" }).click();
  await p.waitForURL(/\/templates\/chats\/\d+$/, { timeout: 90000 });
  const save = p.getByRole("button", { name: /^Save to Your household: .*goldfish/i });
  await save.waitFor({ timeout: 10000 });
  if (await p.getByRole("button", { name: /^Save to Your household: .*cat/i }).count()) throw new Error("offered a pet already held");
  await save.click();
  await p.getByText(/^Saved to Your household: .*goldfish/i).waitFor();
  await p.reload();
  await p.getByText(/^Saved to Your household: .*goldfish/i).waitFor();
  if (await p.getByRole("button", { name: /^Save to Your household/ }).count()) throw new Error("offered again after saving");
  const prof = await p.evaluate(async () => (await (await fetch("/api/household")).json()).profile);
  if (!prof.pets.some((x) => /goldfish/i.test(x)) || !prof.pets.includes("cat") || !prof.members.some((m) => m.name === "Grandma")) throw new Error("household after save: " + JSON.stringify(prof));
  if (/mya/i.test(await p.locator("main").textContent())) throw new Error("a helper name in the chat");
});

await flow("5.2 History talk on a phone: points waiting sit above the lines", "admin", async (p) => {
  const id = await p.evaluate(async () => (await (await fetch("/api/talks")).json()).talks.find((t) => t.waiting > 0)?.id);
  if (!id) throw new Error("no talk with waiting points in the seed");
  await p.goto(`${s.origin}/talks/${id}`);
  const aside = p.locator("main aside");
  await aside.waitFor();
  const [a, l] = await Promise.all([aside.boundingBox(), p.locator("[data-line-bin]").first().boundingBox()]);
  if (!(a.y < l.y)) throw new Error("points are not above the lines while some wait");
});

await flow("ai: the helper cannot reach the chat or the profile", "mya", async (p) => {
  await p.goto(`${s.origin}/templates/household`);
  await p.waitForURL(/\/today/);
  const codes = await p.evaluate(async () => [(await fetch("/api/household")).status, (await fetch("/api/template-chats", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status]);
  if (codes.join() !== "403,403") throw new Error("API answered the helper: " + codes.join());
});

// A helper invite makes a helper, whatever the form or a tampered request says.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  try {
    await signIn(p, "admin", s.origin);
    const code = await p.evaluate(async () => (await (await fetch("/api/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "helper" }) })).json()).code);
    await p.goto("about:blank"); // Talk, left open signed out, would send the page to sign-in mid-navigation
    await ctx.clearCookies();
    await p.goto(`${s.origin}/signup?code=${code}`);
    await p.getByText(/^Helper$|အိမ်အကူ/).first().waitFor(); // 5.3: opens in the phone's language
    if (await p.getByRole("button", { name: /အိမ်ရှင်|Employer/ }).count()) throw new Error("role is still a choice");
    const role = await p.evaluate(async (code) => {
      const r = await fetch("/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, role: "employer", name: "Aye", login: "aye-flow", password: "aye-flow-123", lang: "my" }) });
      return (await r.json()).me?.role;
    }, code);
    if (role !== "helper") throw new Error("helper invite made " + role);
    await p.goto(s.origin);
    await p.waitForURL(/\/today/);
    results.push("PASS helper invite signs up as helper (role fixed, tampering ignored)");
  } catch (e) {
    results.push(`FAIL helper invite: ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}

// 5.0 Kitchen: add a dish with a camera-sized photo and a name, the card lands at the top; Show fills the screen
// with the Burmese name; the helper's Cooked today; search, Favourites, sort.
async function cameraPhoto(p) {
  // a 4032×3024 JPEG as a phone camera takes it (noise makes it well over the server's 8 MiB), made and put
  // into Add a dish's file input inside the page
  return p.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 4032; c.height = 3024;
    const g = c.getContext("2d");
    const img = g.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() * 255) | 0; img.data[i] = v; img.data[i + 1] = 255 - v; img.data[i + 2] = (v * 7) & 255; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    const b = await new Promise((r) => c.toBlob(r, "image/jpeg", 1));
    const input = document.querySelector("main label input[type=file]");
    const dt = new DataTransfer();
    dt.items.add(new File([b], "IMG_0001.jpg", { type: "image/jpeg" }));
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return b.size;
  });
}

for (const [width, who] of [[390, "admin"], [1280, "mei"]]) {
  await flow(`kitchen: ${who} adds a dish from a camera photo, it lands first; Show at ${width}`, who, async (p) => {
    await p.goto(`${s.origin}/kitchen`);
    await p.locator("[data-dish-card]").first().waitFor();
    const before = await p.locator("[data-dish-card]").count();
    const size = await cameraPhoto(p);
    if (size < 8 * 1024 * 1024) throw new Error("test photo too small: " + size);
    const name = `Flow dish ${Math.random().toString(36).slice(2, 6)}`;
    await p.locator("[data-dish-name]").fill(name);
    await p.getByRole("dialog").locator("button[type=submit]").click();
    await p.getByRole("dialog").waitFor({ state: "detached", timeout: 20000 });
    const first = p.locator("[data-dish-card]").first();
    await first.getByText(name).waitFor();
    if ((await p.locator("[data-dish-card]").count()) !== before + 1) throw new Error("card count did not grow by one");
    await first.click();
    await p.waitForURL(/\/kitchen\/\d+$/);
    await p.locator("[data-show]").click();
    await p.locator("[data-show-screen]").waitFor();
    const box = await p.locator("[data-show-screen]").boundingBox();
    if (box.width < width - 1) throw new Error("Show does not fill the screen");
    await p.locator("[data-show-screen]").click({ position: { x: 20, y: box.height / 2 } });
    await p.locator("[data-show-screen]").waitFor({ state: "detached" });
    // seeded favourite: Show reads its Burmese name
    await p.goto(`${s.origin}/kitchen`);
    await p.locator("[data-dish-card]", { hasText: /Hainanese|海南/ }).click();
    await p.locator("[data-show]").click();
    await p.locator("[data-show-screen] [lang=my]", { hasText: "ဟိုင်နန်ကြက်ဆီထမင်း" }).waitFor();
    await p.getByRole("button", { name: /Close|关闭/ }).click();
    await p.locator("[data-show-screen]").waitFor({ state: "detached" });
  }, width, 844);
}

await flow("kitchen: helper reads the note in Burmese, taps Cooked today once; search, Favourites and sort", "mya", async (p) => {
  await p.goto(`${s.origin}/kitchen`);
  await p.locator("[data-dish-card]").first().waitFor();
  await p.locator("[data-dish-card]", { hasText: "ဟိုင်နန်ကြက်ဆီထမင်း" }).click();
  await p.getByText("ထမင်းထဲ ဆားနည်းနည်းထည့်ပါ").waitFor();
  if (await p.locator("[data-favourite]").count()) throw new Error("star control shown to the helper");
  await p.goto(`${s.origin}/kitchen`);
  await p.locator("[data-dish-card]", { hasText: "ကြက်သွန်ဖြူနှင့်" }).click();
  if (!(await p.locator("[data-last-cooked]").textContent()).includes("မချက်ရသေးပါ")) throw new Error("never-cooked line");
  await p.locator("[data-add-recipe]").waitFor();
  await p.locator("[data-cooked]").click();
  await p.locator("[data-cooked]", { hasText: "မှတ်ထားသည်" }).waitFor();
  await p.reload();
  await p.locator("[data-last-cooked]", { hasText: "ယနေ့ ချက်ခဲ့သည်" }).waitFor();
  await p.goto(`${s.origin}/kitchen`);
  await p.locator("[data-dish-card]").first().waitFor();
  await p.locator("[data-kitchen-sort]").selectOption("longest");
  const firstName = await p.locator("[data-dish-card]").first().textContent();
  if (firstName.includes("ကြက်သွန်ဖြူနှင့်")) throw new Error("just-cooked dish still first under longest since cooked");
  await p.getByRole("button", { name: "အကြိုက်ဆုံး" }).click();
  await p.waitForFunction(() => document.querySelectorAll("[data-dish-card]").length === 1, null, { timeout: 3000 }).catch(() => { throw new Error("Favourites filter"); });
  await p.getByRole("button", { name: "အားလုံး" }).click();
  await p.locator("main input[type=search]").fill("zzqq");
  await p.getByText("“zzqq”").waitFor();
  await p.getByText("ဟင်းအဖြစ် ထည့်ရန်").waitFor();
});

console.log(results.join("\n"));
if (errors.length) console.log("Errors:\n" + [...new Set(errors)].slice(0, 15).join("\n"));
await browser.close();
await s.stop();

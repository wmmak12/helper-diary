// Fill the local database with a believable household for review: Purpose, rules, an emergency contact,
// a past talk with drafts waiting, tasks, questions and two of her notes, (2.0) a full calendar month, (4.0) a household profile and a past AI chat. Prints an unused invite code.
// Refuses in production; the release never runs it. Run: pnpm seed:review (uses DATA_DIR, default ./.data).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir, getDb } from "../lib/server/db.ts";

if (process.env.NODE_ENV === "production") {
  console.error("seed:review refuses to run when NODE_ENV is production");
  process.exit(1);
}

const ADMIN_EMAIL = process.env.APP_ADMIN_EMAIL || "admin@example.test";
const ADMIN_PASSWORD = process.env.APP_ADMIN_PASSWORD || "review-password-123";

function hash(password: string) {
  const salt = crypto.randomBytes(16);
  const h = crypto.argon2Sync("argon2id", { message: password, nonce: salt, memory: 19456, passes: 2, parallelism: 1, tagLength: 32 });
  return `argon2id$m=19456,t=2,p=1$${salt.toString("base64")}$${h.toString("base64")}`;
}

const db = getDb();
const q = (sql: string, ...p: unknown[]) => db.prepare(sql).run(...(p as never[]));
const get = <T,>(sql: string, ...p: unknown[]) => db.prepare(sql).get(...(p as never[])) as T | undefined;
const T = Date.now();
const H = 3600_000;
const J = (v: unknown) => JSON.stringify(v);

function today() {
  const tz = process.env.HOUSEHOLD_TZ || "Asia/Singapore";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

if (get("SELECT id FROM entries LIMIT 1")) {
  console.log("Already seeded.");
} else {
  db.exec("BEGIN");
  // ---- people
  let admin = get<{ id: number }>("SELECT id FROM users WHERE login = ?", ADMIN_EMAIL);
  if (!admin) {
    q("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES (?,?,?,?,1,?,?)", ADMIN_EMAIL, "Daniel", hash(ADMIN_PASSWORD), "employer", "en", T - 72 * H);
    admin = get<{ id: number }>("SELECT id FROM users WHERE login = ?", ADMIN_EMAIL)!;
  } else {
    q("UPDATE users SET name = 'Daniel', lang = COALESCE(lang, 'en') WHERE id = ?", admin.id);
  }
  const A = admin.id;
  const mkUser = (login: string, name: string, pw: string, role: string, lang: string) => {
    q("INSERT INTO users (login, name, password_hash, role, is_admin, lang, created_at) VALUES (?,?,?,?,0,?,?)", login, name, hash(pw), role, lang, T - 48 * H);
    const id = get<{ id: number }>("SELECT id FROM users WHERE login = ?", login)!.id;
    q("INSERT INTO invites (code, role, created_by, created_at, used_by, used_at) VALUES (?,?,?,?,?,?)", crypto.randomBytes(5).toString("hex").toUpperCase(), role, A, T - 50 * H, id, T - 48 * H);
    return id;
  };
  const MEI = mkUser("mei", "Mei", "mei-review-123", "employer", "zh");
  const MYA = mkUser("mya", "Mya", "mya-review-123", "helper", "my");

  // ---- Notebook
  const entry = (section: string, pos: number, title: { en: string; zh: string; my: string }, body: { en: string; zh: string; my: string }, extra: { phone?: string; emergency?: boolean; version?: number; by?: number; lang?: "en" | "zh" } = {}) => {
    const lang = extra.lang ?? "en";
    q(
      `INSERT INTO entries (section, title, body, lang, tr, photos, steps, phone, emergency, pos, version, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,'[]','[]',?,?,?,?,?,?,?)`,
      section, title[lang], body[lang], lang, J({ title, body }), extra.phone ?? null, extra.emergency ? 1 : 0, pos, extra.version ?? 1, extra.by ?? A, T - 40 * H, extra.version && extra.version > 1 ? T - 3 * H : T - 40 * H,
    );
    return Number(get<{ id: number }>("SELECT MAX(id) AS id FROM entries")!.id);
  };
  const purpose = entry("purpose", 1,
    { en: "Care for Leo and build a real bond", zh: "照顾 Leo，和他建立真正的感情", my: "Leo ကို ဂရုစိုက်ပြီး ချစ်ခင်ရင်းနှီးမှု တည်ဆောက်ပါ" },
    { en: "Your main job is caring for our son Leo (4). Keep him safe, fed and clean, and get to know him: play, read and talk with him every day. We want him to love you, not just be looked after.",
      zh: "你最主要的工作是照顾我们的儿子 Leo（4岁）。让他安全、吃饱、干净，也要多了解他：每天陪他玩、给他读书、和他聊天。我们希望他喜欢你，而不只是被照看。",
      my: "သင့်အဓိကတာဝန်မှာ ကျွန်ုပ်တို့သား Leo (၄ နှစ်) ကို ဂရုစိုက်ရန်ဖြစ်သည်။ သူ့ကို ဘေးကင်းအောင်၊ ဗိုက်ဝအောင်၊ သန့်ရှင်းအောင် ထားပါ။ နေ့တိုင်း သူနှင့်အတူ ကစားပါ၊ စာဖတ်ပြပါ၊ စကားပြောပါ။ သူ သင့်ကို ချစ်စေချင်ပါသည်၊ စောင့်ရှောက်ခံရရုံသာ မဟုတ်ပါ။" });
  const rule1 = entry("rules", 1,
    { en: "No phone while Leo is in the bath", zh: "Leo 洗澡时不要看手机", my: "Leo ရေချိုးနေစဉ် ဖုန်းမကိုင်ပါနှင့်" },
    { en: "Stay with him the whole time he is in the water. Messages can wait.", zh: "他在水里的时候要一直陪着他。消息可以等一等。", my: "သူ ရေထဲမှာ ရှိနေသမျှ အချိန်တိုင်း သူ့အနားမှာ ရှိနေပါ။ မက်ဆေ့ချ်များကို နောက်မှ ကြည့်နိုင်ပါသည်။" });
  const rule2 = entry("rules", 2,
    { en: "Shoes off at the door", zh: "进门要脱鞋", my: "တံခါးဝမှာ ဖိနပ်ချွတ်ပါ" },
    { en: "Everyone, guests too. Slippers are in the basket by the door.", zh: "所有人都要，包括客人。拖鞋在门边的篮子里。", my: "ဧည့်သည်များအပါအဝင် လူတိုင်း ချွတ်ရပါမည်။ ကွင်းထိုးဖိနပ်များ တံခါးဘေးရှိ ခြင်းထဲတွင် ရှိပါသည်။" });
  const bath = entry("instructions", 1,
    { en: "Leo's bath time", zh: "Leo 的洗澡时间", my: "Leo ရေချိုးချိန်" },
    { en: "Bath at 7 pm. Water warm, not hot: test it with your wrist. After the bath, warm milk and two stories in bed.",
      zh: "晚上7点洗澡。水要温的，不要烫：用手腕试一下水温。洗完澡后喝温牛奶，在床上讲两个故事。",
      my: "ညနေ ၇ နာရီတွင် ရေချိုးပေးပါ။ ရေကို နွေးရုံသာ ထားပါ၊ မပူစေနှင့်၊ လက်ကောက်ဝတ်ဖြင့် စမ်းကြည့်ပါ။ ရေချိုးပြီးလျှင် နို့နွေးတိုက်ပြီး အိပ်ရာထဲတွင် ပုံပြင် နှစ်ပုဒ် ပြောပြပါ။" },
    { version: 2 });
  const laundry = entry("instructions", 2,
    { en: "Laundry", zh: "洗衣服", my: "အဝတ်လျှော်ခြင်း" },
    { en: "Whites and colours separately. Leo's clothes on the gentle cycle with the blue detergent.",
      zh: "白色和彩色衣服分开洗。Leo 的衣服用蓝色洗衣液、轻柔模式洗。",
      my: "အဖြူနှင့် အရောင်ကို သီးခြားလျှော်ပါ။ Leo ၏ အဝတ်များကို အပြာရောင် ဆပ်ပြာရည်ဖြင့် ပျော့ပျော့လျှော်သည့် အစီအစဉ်တွင် လျှော်ပါ။" },
    { lang: "zh", by: MEI });
  const contact = entry("details", 1,
    { en: "Daniel (Leo's father)", zh: "Daniel（Leo 的爸爸）", my: "Daniel (Leo ၏ ဖခင်)" },
    { en: "Call first for anything urgent. If he does not answer, call Mei.", zh: "有急事先打给他。如果他没接，就打给 Mei。", my: "အရေးကြီးကိစ္စရှိလျှင် အရင်ဖုန်းဆက်ပါ။ မကိုင်လျှင် Mei ကို ဖုန်းဆက်ပါ။" },
    { phone: "+65 9123 4567", emergency: true });
  const ambulance = entry("details", 2,
    { en: "Ambulance", zh: "救护车", my: "လူနာတင်ယာဉ်" },
    { en: "For an emergency. Say the address: 12 Orchid Lane, #08-03.", zh: "紧急情况拨打。说出地址：12 Orchid Lane, #08-03。", my: "အရေးပေါ်အခြေအနေအတွက်။ လိပ်စာကို ပြောပါ - 12 Orchid Lane, #08-03။" },
    { phone: "995", emergency: true });
  const allergy = entry("details", 3,
    { en: "Leo is allergic to peanuts", zh: "Leo 对花生过敏", my: "Leo သည် မြေပဲ မတည့်ပါ" },
    { en: "No peanuts or peanut butter, ever. Check labels on biscuits and sauces.", zh: "绝对不能吃花生或花生酱。饼干和酱料要看成分表。", my: "မြေပဲ သို့မဟုတ် မြေပဲထောပတ် လုံးဝ မကျွေးပါနှင့်။ ဘီစကစ်နှင့် ဆော့စ်များ၏ တံဆိပ်ကို စစ်ပါ။" });
  // she confirmed the first version of most entries; bath was edited since
  for (const id of [purpose, rule1, rule2, contact, ambulance, allergy]) q("INSERT INTO entry_reads (entry_id, user_id, seen_version, understood_version, understood_at) VALUES (?,?,1,1,?)", id, MYA, T - 30 * H);
  q("INSERT INTO entry_reads (entry_id, user_id, seen_version, understood_version, understood_at) VALUES (?,?,1,1,?)", bath, MYA, T - 30 * H);
  void laundry;

  // 5.1: Talk shows only today's talk, so this one is on today even just after midnight
  const TT = Math.max(T - 2 * H, new Date(new Date().setHours(0, 5, 0, 0)).getTime());
  // ---- a past talk with drafts waiting
  q("INSERT INTO talks (lang, title, title_tr, created_by, created_at, updated_at, drafted_at) VALUES ('en',?,?,?,?,?,?)",
    "Snacks, dinner and bath time", J({ en: "Snacks, dinner and bath time", zh: "零食、晚饭和洗澡时间", my: "မုန့်၊ ညစာနှင့် ရေချိုးချိန်" }), A, TT, TT + 4 * 60_000, TT + 5 * 60_000);
  const talk = Number(get<{ id: number }>("SELECT MAX(id) AS id FROM talks")!.id);
  const line = (speaker: string, lang: string, tr: Record<string, string>, at: number) =>
    q("INSERT INTO talk_lines (talk_id, speaker, kind, text, lang, tr, created_by, created_at) VALUES (?,?,'text',?,?,?,?,?)", talk, speaker, tr[lang], lang, J(tr), A, at);
  line("employer", "en", { en: "Please don't give Leo any snacks after five. Dinner is at six.", zh: "五点以后请不要给 Leo 吃零食。六点吃晚饭。", my: "ငါးနာရီနောက်ပိုင်း Leo ကို မုန့် မကျွေးပါနှင့်။ ညစာကို ခြောက်နာရီမှာ စားပါမယ်။" }, TT);
  line("helper", "my", { my: "နားလည်ပါပြီ။ ညစာကို ဘယ်အချိန် စချက်ရမလဲ။", en: "I understand. What time should I start cooking dinner?", zh: "明白了。我应该几点开始做晚饭？" }, TT + 60_000);
  line("employer", "en", { en: "Start cooking at half past five. And bath time is now half past seven, not seven.", zh: "五点半开始做饭。还有，洗澡时间现在改成七点半，不是七点了。", my: "ငါးနာရီခွဲမှာ စချက်ပါ။ ပြီးတော့ ရေချိုးချိန်ကို အခု ခုနစ်နာရီခွဲ ပြောင်းထားပါတယ်၊ ခုနစ်နာရီ မဟုတ်တော့ပါ။" }, TT + 2 * 60_000);
  line("helper", "my", { my: "ဟုတ်ကဲ့၊ မှတ်ထားပါမယ်။", en: "Yes, I will remember.", zh: "好的，我会记住。" }, TT + 3 * 60_000);
  const draft = (kind: string, section: string, title: string, body: string, match: string, target: number | null, merged: string | null, reason: string | null) =>
    q("INSERT INTO drafts (talk_id, kind, section, title, body, lang, steps, match, target_entry_id, merged_body, reason, created_at) VALUES (?,?,?,?,?,'en','[]',?,?,?,?,?)",
      talk, kind, section, title, body, match, target, merged, reason, TT + 5 * 60_000);
  draft("instruction", "rules", "No snacks after 5 pm", "Don't give Leo any snacks after 5 pm, so he eats his dinner at 6.", "new", null, null, null);
  draft("instruction", "instructions", "Leo's bath time", "Bath at 7:30 pm (not 7 pm). Water warm, not hot: test it with your wrist. After the bath, warm milk and two stories in bed.", "replace", bath, null, "The Notebook says bath at 7 pm; in this talk it moved to 7:30 pm.");
  draft("keypoint", "instructions", "Start dinner at 5:30 pm", "Start cooking dinner at 5:30 pm so it is ready at 6.", "new", null, null, null);

  // ---- in the same talk, a critical point (a medicine) the app saved by itself: marked auto-added in the Notebook and on Talk
  line("employer", "en", { en: "Leo takes 5 ml of the cough syrup at 8 pm, after dinner. Never more than that.", zh: "Leo 晚上8点、晚饭后喝 5 毫升止咳糖浆。绝对不能多喝。", my: "Leo ကို ညစာစားပြီး ည ၈ နာရီတွင် ချောင်းဆိုးဆေးရည် ၅ မီလီ တိုက်ပါ။ ထို့ထက် ပိုမတိုက်ပါနှင့်။" }, TT + 3 * 60_000 + 30_000);
  const medTalk = talk;
  const medicine = entry("details", 4,
    { en: "Cough syrup: 5 ml at 8 pm", zh: "止咳糖浆：晚上8点 5 毫升", my: "ချောင်းဆိုးဆေးရည် - ည ၈ နာရီ ၅ မီလီ" },
    { en: "Give Leo 5 ml of the cough syrup at 8 pm, after dinner. Never more than 5 ml.", zh: "晚上8点、晚饭后给 Leo 喝 5 毫升止咳糖浆。绝对不能超过 5 毫升。", my: "ညစာစားပြီး ည ၈ နာရီတွင် Leo ကို ချောင်းဆိုးဆေးရည် ၅ မီလီ တိုက်ပါ။ ၅ မီလီထက် ဘယ်တော့မှ ပိုမတိုက်ပါနှင့်။" });
  q("UPDATE entries SET source_talk_id = ?, auto_talk_id = ?, created_at = ?, updated_at = ? WHERE id = ?", medTalk, medTalk, TT + 5 * 60_000, TT + 5 * 60_000, medicine);
  q("INSERT INTO drafts (talk_id, kind, section, title, body, lang, steps, match, created_at, status, auto, entry_id, decided_at) VALUES (?,?,?,?,?,'en','[]','new',?,'approved',1,?,?)",
    medTalk, "instruction", "details", "Cough syrup: 5 ml at 8 pm", "Give Leo 5 ml of the cough syrup at 8 pm, after dinner. Never more than 5 ml.", TT + 5 * 60_000, medicine, TT + 5 * 60_000);

  // ---- Today
  const d = today();
  const task = (title: Record<string, string>, note: Record<string, string>, time: string | null, kind: string, weekdays: number[], date: string | null, lang = "en") => {
    q("INSERT INTO tasks (title, note, lang, tr, time, kind, weekdays, date, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      title[lang], note[lang] ?? "", lang, J({ title, note }), time, kind, J(weekdays), date, A, T - 40 * H, T - 40 * H);
    return Number(get<{ id: number }>("SELECT MAX(id) AS id FROM tasks")!.id);
  };
  const breakfast = task({ en: "Make Leo's breakfast", zh: "给 Leo 做早餐", my: "Leo အတွက် မနက်စာ ပြင်ပါ" }, { en: "Porridge or toast with egg. No peanut butter.", zh: "粥或吐司配鸡蛋。不要花生酱。", my: "ဆန်ပြုတ် သို့မဟုတ် ကြက်ဥနှင့် ပေါင်မုန့်ကင်။ မြေပဲထောပတ် မထည့်ပါနှင့်။" }, "07:00", "routine", [], null);
  task({ en: "Walk Leo to kindergarten", zh: "送 Leo 去幼儿园", my: "Leo ကို မူကြိုကျောင်း လိုက်ပို့ပါ" }, { en: "", zh: "", my: "" }, "08:30", "routine", [1, 2, 3, 4, 5], null);
  task({ en: "Mop the floors", zh: "拖地", my: "ကြမ်းပြင် တိုက်ပါ" }, { en: "Living room and kitchen.", zh: "客厅和厨房。", my: "ဧည့်ခန်းနှင့် မီးဖိုချောင်။" }, "14:00", "routine", [], null);
  task({ en: "Buy milk and bread", zh: "买牛奶和面包", my: "နို့နှင့် ပေါင်မုန့် ဝယ်ပါ" }, { en: "From the shop downstairs. Money is in the kitchen drawer.", zh: "在楼下的店买。钱在厨房抽屉里。", my: "အောက်ထပ်ဆိုင်မှ ဝယ်ပါ။ ပိုက်ဆံ မီးဖိုချောင် အံဆွဲထဲမှာ ရှိပါသည်။" }, "16:00", "once", [], d);
  task({ en: "Bath and bedtime stories", zh: "洗澡和睡前故事", my: "ရေချိုးပြီး အိပ်ရာဝင် ပုံပြင်ပြောပါ" }, { en: "", zh: "", my: "" }, "19:00", "routine", [], null);
  q("INSERT INTO task_done (task_id, date, user_id, at) VALUES (?,?,?,?)", breakfast, d, MYA, T - 1 * H);

  // ---- questions
  q("INSERT INTO questions (asker_id, text, lang, tr, ref_type, ref_id, created_at) VALUES (?,?,?,?,?,?,?)", MYA,
    "ရေချိုးပြီးရင် Leo ရဲ့ ဆံပင်ကို လေမှုတ်စက်နဲ့ အခြောက်ခံပေးရမလား။", "my",
    J({ my: "ရေချိုးပြီးရင် Leo ရဲ့ ဆံပင်ကို လေမှုတ်စက်နဲ့ အခြောက်ခံပေးရမလား။", en: "After the bath, should I dry Leo's hair with the hair dryer?", zh: "洗完澡后，我要用吹风机把 Leo 的头发吹干吗？" }),
    "entry", bath, T - 50 * 60_000);
  q("INSERT INTO questions (asker_id, text, lang, tr, answer, answer_lang, answer_tr, answered_by, answered_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)", MYA,
    "ညဘက်မှာ အဝတ်လျှော်စက် သုံးလို့ရလား။", "my",
    J({ my: "ညဘက်မှာ အဝတ်လျှော်စက် သုံးလို့ရလား။", en: "Can I use the washing machine at night?", zh: "晚上可以用洗衣机吗？" }),
    "可以，但请在晚上十点前用完，邻居要睡觉。", "zh",
    J({ zh: "可以，但请在晚上十点前用完，邻居要睡觉。", en: "Yes, but please finish before 10 pm; the neighbours sleep.", my: "ရပါတယ်၊ ဒါပေမဲ့ ည ၁၀ နာရီမတိုင်ခင် ပြီးအောင် လုပ်ပါ၊ အိမ်နီးချင်းတွေ အိပ်ကြလို့ပါ။" }),
    MEI, T - 5 * H, T - 20 * H);

  // ---- her notes
  q("INSERT INTO collections (owner_id, name, created_at) VALUES (?,?,?)", MYA, "ဟင်းချက်နည်း", T - 30 * H);
  const recipes = Number(get<{ id: number }>("SELECT MAX(id) AS id FROM collections")!.id);
  q("INSERT INTO collections (owner_id, name, created_at) VALUES (?,?,?)", MYA, "နေ့စဉ်မှတ်တမ်း", T - 30 * H);
  const diary = Number(get<{ id: number }>("SELECT MAX(id) AS id FROM collections")!.id);
  q("INSERT INTO notes (owner_id, collection_id, title, body, lang, photos, shared, created_at, updated_at) VALUES (?,?,?,?,'my','[]',0,?,?)", MYA, recipes,
    "Leo ကြိုက်တဲ့ ကြက်သားဆန်ပြုတ်", "ဆန် တစ်ခွက်၊ ရေ ခြောက်ခွက်။ ကြက်သားကို အရင်ပြုတ်ပါ။ ဂျင်း နည်းနည်း ထည့်ပါ။ ဆား နည်းနည်းသာ။", T - 26 * H, T - 26 * H);
  q("INSERT INTO notes (owner_id, collection_id, title, body, lang, tr, photos, shared, created_at, updated_at) VALUES (?,?,?,?,'my',?,'[]',1,?,?)", MYA, diary,
    "ဒီနေ့ Leo စကားလုံးအသစ် သင်ယူခဲ့တယ်", "ဒီနေ့ Leo က မြန်မာလို \"ကျေးဇူးတင်ပါတယ်\" လို့ ပြောတတ်သွားပြီ။ အရမ်းပျော်ဖို့ကောင်းတယ်။",
    J({ title: { my: "ဒီနေ့ Leo စကားလုံးအသစ် သင်ယူခဲ့တယ်", en: "Leo learnt a new word today", zh: "Leo 今天学会了一个新词" },
        body: { my: "ဒီနေ့ Leo က မြန်မာလို \"ကျေးဇူးတင်ပါတယ်\" လို့ ပြောတတ်သွားပြီ။ အရမ်းပျော်ဖို့ကောင်းတယ်။", en: "Today Leo learnt to say \"thank you\" in Burmese. It was so lovely.", zh: "今天 Leo 学会了用缅甸语说“谢谢”。太开心了。" } }),
    T - 6 * H, T - 6 * H);
  // ---- 2.0 calendar: routines started 20 days ago, a weekly and a monthly task, an event, a day off, a moved
  // occurrence, and a full past day (talk, notes, a Notebook entry and ticks) so every part of the calendar shows.
  const addDays = (date: string, n: number) => {
    const x = new Date(date + "T12:00:00Z");
    x.setUTCDate(x.getUTCDate() + n);
    return x.toISOString().slice(0, 10);
  };
  const wd = (date: string) => new Date(date + "T12:00:00Z").getUTCDay();
  const start = addDays(d, -20);
  q("UPDATE tasks SET repeat = CASE WHEN weekdays = '[]' THEN 'daily' ELSE 'weekly' END, start_date = ? WHERE kind = 'routine'", start);
  const ironing = task({ en: "Iron school uniforms", zh: "熨校服", my: "ကျောင်းဝတ်စုံများ မီးပူတိုက်ပါ" }, { en: "Two shirts and shorts for Leo.", zh: "Leo 的两件衬衫和短裤。", my: "Leo အတွက် ရှပ်အင်္ကျီ နှစ်ထည်နှင့် ဘောင်းဘီတို။" }, "10:00", "routine", [2, 5], null);
  q("UPDATE tasks SET repeat = 'weekly', start_date = ? WHERE id = ?", addDays(d, -21), ironing);
  // monthly on the 31st: in a 30-day month it falls on the 30th
  const fridge = task({ en: "Clean the fridge", zh: "清洁冰箱", my: "ရေခဲသေတ္တာ သန့်ရှင်းရေးလုပ်ပါ" }, { en: "Throw out old food, wipe the shelves.", zh: "扔掉过期食物，擦干净隔板。", my: "အဟောင်းများ လွှင့်ပစ်ပြီး စင်များကို သုတ်ပါ။" }, "11:00", "routine", [], null);
  const monthStart = d.slice(0, 7) + "-01";
  const prev31 = (() => {
    // the last month before this one with 31 days
    for (let k = 1; k < 12; k++) {
      const x = new Date(monthStart + "T12:00:00Z");
      x.setUTCMonth(x.getUTCMonth() - k);
      const cand = x.toISOString().slice(0, 8) + "31";
      if (new Date(cand + "T12:00:00Z").toISOString().slice(0, 10) === cand) return cand;
    }
    return addDays(d, -40);
  })();
  q("UPDATE tasks SET repeat = 'monthly', start_date = ? WHERE id = ?", prev31, fridge);
  // the next Sunday from today (today included) is her day off; the event is two days from today
  let sunday = d;
  while (wd(sunday) !== 0) sunday = addDays(sunday, 1);
  q("INSERT INTO cal_items (kind, date, title, lang, created_by, created_at) VALUES ('dayoff',?,'','en',?,?)", sunday, A, T - 20 * H);
  const event = { en: "Grandma's birthday dinner", zh: "奶奶的生日晚餐", my: "အဖွားရဲ့ မွေးနေ့ ညစာ" };
  q("INSERT INTO cal_items (kind, date, title, lang, tr, time, created_by, created_at) VALUES ('event',?,?,'en',?,?,?,?)", addDays(d, 2), event.en, J({ title: event }), "18:30", A, T - 20 * H);
  // the next ironing day after today moves to the following Monday (the series has no Mondays)
  let ironDay = addDays(d, 1);
  while (![2, 5].includes(wd(ironDay))) ironDay = addDays(ironDay, 1);
  let monday = ironDay;
  while (wd(monday) !== 1) monday = addDays(monday, 1);
  q("INSERT INTO task_moves (task_id, from_date, to_date) VALUES (?,?,?)", ironing, ironDay, monday);
  // a full past day, three days ago
  const past = addDays(d, -3);
  const pastAt = new Date(past + "T10:00:00+08:00").getTime();
  q("INSERT INTO talks (lang, title, title_tr, created_by, created_at, updated_at) VALUES ('zh',?,?,?,?,?)",
    "周末的客人", J({ zh: "周末的客人", en: "Guests at the weekend", my: "စနေ၊ တနင်္ဂနွေ ဧည့်သည်များ" }), MEI, pastAt, pastAt + 3 * 60_000);
  const pastTalk = Number(get<{ id: number }>("SELECT MAX(id) AS id FROM talks")!.id);
  const pline = (speaker: string, lang: string, tr: Record<string, string>, at: number) =>
    q("INSERT INTO talk_lines (talk_id, speaker, kind, text, lang, tr, created_by, created_at) VALUES (?,?,'text',?,?,?,?,?)", pastTalk, speaker, tr[lang], lang, J(tr), MEI, at);
  pline("employer", "zh", { zh: "星期六奶奶来吃晚饭，请多做一个菜。", en: "Grandma comes for dinner on Saturday, please cook one more dish.", my: "စနေနေ့ အဖွား ညစာစားလာမယ်၊ ဟင်းတစ်မျိုး ပိုချက်ပေးပါ။" }, pastAt);
  pline("helper", "my", { my: "ဟုတ်ကဲ့၊ ငါးချက်ပေးရမလား။", en: "Yes, shall I cook fish?", zh: "好的，要做鱼吗？" }, pastAt + 60_000);
  q("INSERT INTO notes (owner_id, collection_id, title, body, lang, photos, shared, created_at, updated_at) VALUES (?,?,?,?,'my','[]',0,?,?)", MYA, diary,
    "ကိုယ်ပိုင်မှတ်စု", "အမေ့ဆီ ဖုန်းဆက်ရန် သတိရပါ။", pastAt + H, pastAt + H);
  q("INSERT INTO notes (owner_id, collection_id, title, body, lang, tr, photos, shared, created_at, updated_at) VALUES (?,?,?,?,'my',?,'[]',1,?,?)", MYA, recipes,
    "ငါးပေါင်း", "ငါးကို ဂျင်းနှင့် ကြက်သွန်ဖြူဖြင့် မိနစ် ၁၅ ပေါင်းပါ။",
    J({ title: { my: "ငါးပေါင်း", en: "Steamed fish", zh: "清蒸鱼" }, body: { my: "ငါးကို ဂျင်းနှင့် ကြက်သွန်ဖြူဖြင့် မိနစ် ၁၅ ပေါင်းပါ။", en: "Steam the fish with ginger and garlic for 15 minutes.", zh: "鱼加姜蒜蒸15分钟。" } }),
    pastAt + 2 * H, pastAt + 2 * H);
  const guests = entry("instructions", 9, { en: "When guests come for dinner", zh: "客人来吃晚饭时", my: "ဧည့်သည် ညစာစားလာသောအခါ" },
    { en: "Cook one more dish and set the table by 6 pm.", zh: "多做一个菜，六点前摆好餐桌。", my: "ဟင်းတစ်မျိုး ပိုချက်ပြီး ညနေ ၆ နာရီမတိုင်မီ စားပွဲပြင်ပါ။" }, { by: MEI });
  q("UPDATE entries SET created_at = ?, updated_at = ? WHERE id = ?", pastAt + 30 * 60_000, pastAt + 30 * 60_000, guests);
  for (const r of db.prepare("SELECT id FROM tasks WHERE kind = 'routine' AND repeat = 'daily'").all() as { id: number }[])
    q("INSERT OR IGNORE INTO task_done (task_id, date, user_id, at) VALUES (?,?,?,?)", r.id, past, MYA, pastAt + 8 * H);
  // 3.0: one saved template under My templates, saved by Mei in 中文
  q("INSERT INTO templates (name, lang, tasks, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)", "周末大扫除", "zh", J([
    { title: "换洗全家床单和枕套", note: "床单用热水洗，挂在竹竿上晒干", time: "09:00", repeat: "weekly", weekdays: [6], day: null },
    { title: "擦所有窗户和铁花", note: "高处只擦里面，不要站在窗台上", time: "10:30", repeat: "weekly", weekdays: [6], day: null },
    { title: "清洗冷气机过滤网", note: "", time: "14:00", repeat: "monthly", weekdays: [], day: null },
    { title: "拖阳台并清理排水口", note: "", time: "16:00", repeat: "weekly", weekdays: [0], day: null },
  ]), MEI, Date.now() - 2 * 24 * H, Date.now() - 2 * 24 * H);
  // 4.0: a filled household profile and one past AI chat whose proposal was accepted (saved under My templates)
  q("INSERT INTO household_profile (id, data, updated_by, updated_at) VALUES (1, ?, ?, ?)", J({
    members: [{ name: "", age: 41 }, { name: "", age: 38 }, { name: "Grandma", age: 82 }, { name: "Leo", age: 3 }],
    pets: ["cat"], bedrooms: 3, bathrooms: 2, floors: 1, garden: false,
    matters: "Clean floors (Leo plays on them) and Grandma's medicine on time",
  }), A, T - 26 * H);
  const weekTasks = [
    { title: "Give Grandma her morning medicine", note: "Pill box by her bed; watch her take it with warm water", time: "07:15", repeat: "daily", weekdays: [], day: null },
    { title: "Feed the cat and change its water", note: "Half a tin of wet food; rinse the bowl", time: "07:45", repeat: "daily", weekdays: [], day: null },
    { title: "Mop the living room and kitchen floors", note: "Leo plays on them, so use the mild floor soap", time: "09:00", repeat: "daily", weekdays: [], day: null },
    { title: "Scoop the cat litter tray", note: "Bag it and take it to the bin chute", time: "10:00", repeat: "daily", weekdays: [], day: null },
    { title: "Clean both bathrooms", note: "Toilets, sinks and shower; the bathroom cloth only", time: "10:30", repeat: "weekly", weekdays: [1, 4], day: null },
    { title: "Change the bed linen in all three bedrooms", note: "Straight into the wash basket", time: "10:00", repeat: "weekly", weekdays: [2], day: null },
    { title: "Cook a soft lunch for Grandma and Leo", note: "Cut Leo's food small; keep Grandma's soft", time: "11:30", repeat: "daily", weekdays: [], day: null },
    { title: "Pick up Leo's toys and tidy his room", note: "Toys back in the same boxes", time: "17:00", repeat: "daily", weekdays: [], day: null },
    { title: "Bath Leo and get his pyjamas on", note: "Warm, not hot; lay pyjamas out first", time: "18:45", repeat: "daily", weekdays: [], day: null },
    { title: "Give Grandma her evening medicine", note: "Stay with her until she has taken it", time: "20:00", repeat: "daily", weekdays: [], day: null },
  ];
  const chatAt = T - 25 * H;
  q("INSERT INTO templates (name, lang, tasks, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)", "Our week with Grandma and Leo", "en", J(weekTasks), A, chatAt + 10 * 60_000, chatAt + 10 * 60_000);
  const accepted = get<{ id: number }>("SELECT id FROM templates WHERE name = ?", "Our week with Grandma and Leo")!.id;
  q(`INSERT INTO tpl_chats (title, lang, proposal, proposal_state, accepted_ref, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`,
    "A weekly routine for our helper, please", "en", J({ name: "Our week with Grandma and Leo", lang: "en", tasks: weekTasks.map((t) => ({ ...t, from: null })) }), "accepted", `mine:${accepted}`, A, chatAt, chatAt + 10 * 60_000);
  const chatId = get<{ id: number }>("SELECT id FROM tpl_chats ORDER BY id DESC LIMIT 1")!.id;
  const msg = (role: string, kind: string, text: string, at: number, proposal: unknown = null) =>
    q("INSERT INTO tpl_chat_messages (chat_id, role, kind, text, lang, proposal, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)", chatId, role, kind, text, "en", proposal ? J(proposal) : null, role === "user" ? A : null, at);
  msg("user", "text", "A weekly routine for our helper, please", chatAt);
  msg("ai", "question", "Does Grandma take any medicine at set times each day?", chatAt + 20_000);
  msg("user", "text", "Yes, morning and evening", chatAt + 3 * 60_000);
  msg("ai", "proposal", "Here is a week built around clean floors for Leo and Grandma's medicine on time.", chatAt + 3 * 60_000 + 25_000, { name: "Our week with Grandma and Leo", count: weekTasks.length });
  db.exec("COMMIT");
  console.log("Seeded the household.");
}

// 5.0 Kitchen: four dishes with their photos (design/seed): a favourite with a note, one with a recipe, one
// cooked last week, one never cooked. Runs on its own so an install seeded before 5.0 gets them too.
if (!get("SELECT id FROM dishes LIMIT 1")) {
  const by = (login: string) => get<{ id: number }>("SELECT id FROM users WHERE login = ?", login)?.id ?? null;
  const A = get<{ id: number }>("SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1")!.id;
  const MEI = by("mei") ?? A;
  const MYA = by("mya") ?? A;
  const photosDir = path.join(dataDir(), "photos");
  fs.mkdirSync(photosDir, { recursive: true });
  const photo = (file: string, uploader: number) => {
    const src = path.join(process.cwd(), "design", "seed", file);
    if (!fs.existsSync(src)) {
      console.warn(`seed: ${src} is missing; that dish has no photo`);
      return null;
    }
    const id = crypto.randomBytes(12).toString("base64url");
    fs.copyFileSync(src, path.join(photosDir, id));
    q("INSERT INTO photos (id, uploader, mime, created_at) VALUES (?,?,?,?)", id, uploader, "image/jpeg", T);
    return id;
  };
  const day = (n: number) => {
    const d = new Date(today() + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const dish = (o: { name: string; lang: string; tr: Record<string, string>; photo: string; by: number; ago: number; fav?: boolean; note?: [string, string, Record<string, string>]; recipe?: [string, string, string, unknown]; cooked?: number[] }) => {
    const at = T - o.ago * 24 * H;
    q(
      `INSERT INTO dishes (name, lang, tr, photo_id, favourite, note, note_lang, note_tr, ingredients, steps, recipe_lang, recipe_tr, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      o.name, o.lang, J(o.tr), photo(o.photo, o.by), o.fav ? 1 : 0,
      o.note?.[0] ?? "", o.note?.[1] ?? null, o.note ? J(o.note[2]) : null,
      o.recipe?.[0] ?? "", o.recipe?.[1] ?? "", o.recipe?.[2] ?? null, o.recipe ? J(o.recipe[3]) : null,
      o.by, at, at,
    );
    const id = get<{ id: number }>("SELECT id FROM dishes ORDER BY id DESC LIMIT 1")!.id;
    for (const n of o.cooked ?? []) q("INSERT OR IGNORE INTO dish_cooked (dish_id, date, user_id, at) VALUES (?,?,?,?)", id, day(-n), MYA, T - n * 24 * H);
  };
  dish({
    name: "Hainanese chicken rice", lang: "en", photo: "dish-chicken-rice.jpg", by: A, ago: 20, fav: true, cooked: [16, 9, 3],
    tr: { en: "Hainanese chicken rice", zh: "海南鸡饭", my: "ဟိုင်နန်ကြက်ဆီထမင်း" },
    note: ["Less salt in the rice, Grandma's blood pressure", "en", { en: "Less salt in the rice, Grandma's blood pressure", zh: "米饭少放盐，奶奶血压高", my: "ထမင်းထဲ ဆားနည်းနည်းထည့်ပါ၊ အဖွားသွေးတိုးလို့ပါ" }],
  });
  const ing = "ငါးခူ (သို့) ငါးမြစ်ချင်း ၁ ကောင်\nဆန်မှုန့် ၃ ဇွန်း\nငှက်ပျောအူ\nကြက်သွန်နီ၊ ကြက်သွန်ဖြူ၊ ချင်း၊ စပါးလင်\nနနွင်းမှုန့်၊ ငံပြာရည်\nဆန်ခေါက်ဆွဲ";
  const steps = "၁။ ငါးကို စပါးလင်နှင့် ပြုတ်ပြီး အရိုးထုတ်ပါ။\n၂။ ကြက်သွန်၊ ချင်း၊ နနွင်းကို ဆီနှင့် ကြော်ပါ။\n၃။ ငါးနှင့် ဆန်မှုန့်ကို ရေထဲထည့်ပြီး ဟင်းရည်ကို နာရီဝက် တည်ပါ။\n၄။ ငှက်ပျောအူ ထည့်ပြီး ခေါက်ဆွဲနှင့် တွဲပေးပါ။";
  dish({
    name: "မုန့်ဟင်းခါး", lang: "my", photo: "dish-mohinga.jpg", by: MYA, ago: 14, cooked: [10],
    tr: { my: "မုန့်ဟင်းခါး", en: "Mohinga (fish noodle soup)", zh: "鱼汤米粉（缅甸鱼汤粉）" },
    recipe: [ing, steps, "my", {
      ingredients: { my: ing, en: "1 catfish or river fish\n3 spoons rice flour\nBanana stem\nShallots, garlic, ginger, lemongrass\nTurmeric, fish sauce\nRice noodles", zh: "鲶鱼或河鱼 1 条\n米粉 3 勺\n香蕉茎\n红葱、蒜、姜、香茅\n黄姜粉、鱼露\n米线" },
      steps: { my: steps, en: "1. Boil the fish with lemongrass and take out the bones.\n2. Fry the shallots, ginger and turmeric in oil.\n3. Add the fish and rice flour to the water and simmer the soup for half an hour.\n4. Add the banana stem and serve with the noodles.", zh: "1. 鱼和香茅一起煮，去骨。\n2. 用油炒红葱、姜和黄姜。\n3. 把鱼和米粉加进水里，汤煮半小时。\n4. 加入香蕉茎，配米线上桌。" },
    }],
  });
  dish({ name: "番茄炒蛋", lang: "zh", photo: "dish-tomato-egg.jpg", by: MEI, ago: 9, cooked: [7], tr: { zh: "番茄炒蛋", en: "Tomato and egg stir-fry", my: "ခရမ်းချဉ်သီး ကြက်ဥကြော်" } });
  dish({ name: "Garlic kailan", lang: "en", photo: "dish-kailan.jpg", by: A, ago: 2, tr: { en: "Garlic kailan", zh: "蒜蓉芥兰", my: "ကြက်သွန်ဖြူနှင့် ဂေါ်ဖီတိုကြော်" } });
  console.log("Seeded four Kitchen dishes.");
}

// an unused invite for the reviewer to try sign-up with
const admin = get<{ id: number }>("SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1")!;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let code = "";
for (const b of crypto.randomBytes(10)) code += alphabet[b % alphabet.length];
code = `${code.slice(0, 5)}-${code.slice(5)}`;
q("INSERT INTO invites (code, role, created_by, created_at) VALUES (?,?,?,?)", code, "employer", admin.id, Date.now());
console.log(`Admin sign-in: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
console.log("Helper sign-in: mya / mya-review-123 (Burmese)   Other employer: mei / mei-review-123 (中文)");
console.log(`Unused invite code: ${code}`);

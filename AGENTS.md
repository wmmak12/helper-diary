# Helper Diary — agent guide
A household app for a family and their helper: hold-to-talk translation on one phone, saved talks drafted into her Notebook, Today and Questions. Stack: pnpm, Next.js 16 App Router, TypeScript, Tailwind 4, SQLite (node:sqlite) on the Node server runtime; phone browser first. For people, start with README.md.
Status: 5.6 (web app for phone browsers; no phone apps)

## Rules
- design/ is the brand source: tokens design/style.md, motion design/motion.md, art design/manifest.json. Never edit generated art.
- The JSON API under app/api is a contract: keep it separate from the UI; shapes live in lib/types.ts.
- Every API route goes through route() in lib/server/api.ts (Origin check, session, employer/admin guards); only the public session, signup and reset routes check the Origin and their rate limits themselves. Never read Remote-* headers. JSON bodies are read with body() (1 MB limit), uploads with formBody() (8 MB), never req.formData(). Public routes check a code or invite before hashing a password. Rate limits key on clientAddress() (last X-Forwarded-For entry), never the first entry.
- Hold records (1.4): Talk silently POSTs each hold and page load to /api/holds; they are read only from the server log or `DATA_DIR=… node scripts/hold-records.mjs` (docs/testing.md). Never add a screen, read route or audio to them (5.3 removed GET /api/holds).
- A helper never sees a talk from before she joined.
- Nothing reaches the helper until an employer approves it or the drafter auto-saves it as critical (marked auto-added); private notes go only to their owner and never to the model.
- Languages are lib/languages.ts; add one there plus its strings in lib/strings/*.ts. Burmese never in fixed-height boxes, line-height ≥1.8.
- AI (5.3): any OpenAI-compatible provider. Text AI uses the owner's Settings values, else the server's AI_BASE_URL / AI_API_KEY / AI_MODEL, else none (texts save untranslated). Speech to text uses only the owner's speech settings (OpenAI `audio/transcriptions`, or DeepSeek when the address ends in `/tools/asr`); Hold to talk shows only when they are set. Keys stay on the server, are never logged and never returned in full (only a hint). Translate only into the household's languages. The held button records 16 kHz WAV (lib/client/recorder.ts); audio is never stored. The phone's own speech recognition is not used.
- Every server setting is listed in .env.example; add a new one there. Comments, docs and seed data name no real person, device, server or host.

## Commands
- install: `pnpm install` (nodeLinker hoisted)
- build: `pnpm build`
- check: `pnpm typecheck`, `pnpm lint`, `pnpm test` (server tests), flow check `node tools/flows.mjs` (after build + release)
- release: `pnpm build && pnpm release` writes release/server (server.mjs entrypoint) and release/site; `RELEASE_DIR=<folder> pnpm release` writes another folder (a host that publishes a committed package keeps its own folder and notes outside the public source)

## Review access
- Start: `pnpm build && pnpm release && node scripts/review-session.mjs` (temp DATA_DIR, fixture APP_ADMIN_EMAIL=admin@example.test, APP_ADMIN_PASSWORD=review-password-123, seeded; prints the origin).
- By hand: `DATA_DIR=$(mktemp -d) APP_ADMIN_EMAIL=admin@example.test APP_ADMIN_PASSWORD=review-password-123 pnpm seed:review` then `DATA_DIR=<same> APP_ADMIN_EMAIL=… APP_ADMIN_PASSWORD=… PORT=8080 node release/server/server.mjs`.
- Seed: `pnpm seed:review` (refuses when NODE_ENV=production) prints an unused invite code; it also fills this month's calendar (weekly and monthly tasks, an event, a day off, a moved occurrence, a full past day).
- Seed (4.0) also fills the household profile and one accepted AI chat; (5.0) four Kitchen dishes with photos from design/seed/.
- Demo household: Daniel (admin@example.test / review-password-123, the owner, employer, English, lands on Talk); mei / mei-review-123 (employer, 中文); mya / mya-review-123 (helper, Burmese, lands on Today; seeded talks predate her, so her History is empty). The seed sets no AI settings: Hold to talk is hidden until the owner fills Speech in Settings.
- Session script: scripts/review-session.mjs — `start()` → { origin, stop }, `signIn(page, who)` signs in through the real form.

## Map
<!-- map -->
- app/ (95 files)
- app/{join,signin,signup,reset}/ — public sign-in, invite sign-up and (5.5) a new password from a reset code
- app/(app)/ (21 files) — signed-in screens: talk, talks (History), kitchen, kitchen/[id], notebook, notes, today, calendar, templates (employer; chats/[id], household), questions, search, settings (owner's AI section #ai)
- app/api/ (67 files) — JSON API (session, me (5.4 me/password), signup, reset (5.5, public), invites, members (5.5 members/[id]/reset), talks, lines, drafts, entries, notes, collections, tasks, today, questions, photos, search, translate, listen, holds (POST only), calendar, templates, template-chats, household, dishes, ai-settings (5.3, owner only))
- components/ (43 files) — AppShell, ui primitives, BurmeseKeyboard
- components/auth/ (7 files) — sign-in/up, ResetForm (5.5), SettingsScreen (5.4 Change password, 5.5 Reset password), LangSwitch (five language buttons), AiSettings (owner's text and speech settings)
- components/calendar/ (5 files) — month/week grid, day page, Add and Move sheets
- components/drafts/ (2 files) — DraftList, AutoAdded mark and list
- components/kitchen/ (3 files) — KitchenScreen (book, search, Favourites, sort), DishScreen (Show, note, recipe, Cooked today), DishSheet (add/edit: photo + name)
- components/notebook/ (4 files)
- components/notes/ (3 files)
- components/talk/ (3 files) — TalkScreen (today's talk, Past talks row, text box + Send, Hold to talk when speech is set, helper button in her language, owner's setup line), TalkLine, HoldButton
- components/talks/ (3 files) — History list, Transcript, HistoryButton
- components/templates/ (6 files) — TemplatesScreen, TemplateEditor, ChatScreen, AskBox, HouseholdScreen
- components/today/ (4 files) — TodayScreen, TaskRow, TaskSheet, TomorrowView
- design/ — brand kit, style and motion, the three reference pictures in design/directions/1; public/ — icons, og, hero, empty states, web manifest
- design/seed/ (4 files, mostly images) — seed dish photos
- docs/screenshots/ — README screenshots of the demo household
- lib/ (46 files) — lib/languages.ts (five languages), lib/types.ts (API shapes), lib/templates/samples.ts
- lib/client/ (5 files) — api client, i18n context, useApi, recorder (records while held, /api/listen on release), holdLog (silent hold records)
- lib/server/ (22 files) — db (+ migrate), auth (passwords, sessions, sign-in limits), api helpers, household domain logic, templates, tplchat, kitchen, ai (text AI: owner settings, else server env), aisettings (5.3), backfill (5.3 new-language back-fill), listen (OpenAI-style or DeepSeek transcription), photos, holds; test/ (`pnpm test`)
- lib/strings/ (16 files) — per-screen strings in all five languages (ai.ts: AI settings and Talk's setup line)
- public/ (19 files, mostly images)
- scripts/ (5 files) — release.mjs (writes release/), seed-review.ts, review-session.mjs, hold-records.mjs (reads hold records), reset-owner-password.mjs (5.5, run on the server)
- tools/ (1 files) — flows.mjs flow check (FLOWS_ONLY=<text> walks matching flows)
<!-- /map -->

## Docs (read when…)
- docs/architecture.md — changing more than one module, or a contract
- docs/testing.md — running checks, fixtures, the flow check

## Maintaining these docs
When a change touches a module, a contract or a check, rewrite the matching section of docs/architecture.md or
docs/testing.md in the same commit, and keep the Map above in step with the folders. Never paste secrets, internal
URLs, real names or emails: this repository is public.

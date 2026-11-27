# Architecture

## Overview
One Next.js 16 App Router app (pnpm, TypeScript, Tailwind 4) for one household. The UI (`app/(app)/**`, `components/**`)
talks to a JSON API (`app/api/**`), kept separate from the UI so another client could reuse it. Data is SQLite (`node:sqlite`) under `DATA_DIR`.

## Routes/screens
- `/signin`, `/signup?code=` (`/join` redirects), `/reset?code=` (5.5): public. `/` sends employers to `/talk`, the helper to `/today`.
- `(app)` group, behind the session (`app/(app)/layout.tsx`): `/talk`, `/talks`, `/talks/[id]`, `/notebook`, `/notebook/[id]`,
  `/notes`, `/notes/[id]`, `/today`, `/calendar`, `/calendar/[date]` (2.0), `/templates`, `/templates/[ref]` (3.0, employer only; `sample-baby`, `mine-12`, 4.0 `chat-7` = a chat's proposal in the editor), `/templates/chats/[id]` and `/templates/household` (4.0, employer only), `/kitchen`, `/kitchen/[id]` (5.0), `/questions`, `/search`, `/settings`. Shell: `components/AppShell.tsx` (phone tabs, desktop sidebar, toasts, language pick).

## API
Source of truth: `app/api/**/route.ts`, thin wrappers over `lib/server/household.ts`. Every route goes through `route()` in
`lib/server/api.ts`: Origin check on writes, signed-in user, `employer`/`admin` guards. Shapes: `lib/types.ts`.
5.4: `body()` reads a JSON body in pieces and refuses more than 1 MB (413 `too_large`) or anything that is not an object (400 `bad_json`); photos and recordings are form uploads with their own 8 MiB limits. 5.6: they are read with `formBody()`, which refuses a body past `MAX_UPLOAD` (8 MiB plus 64 KiB for the form) while it arrives (413), never `req.formData()`, which holds the whole body in memory first. `next.config.ts` adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` and `Strict-Transport-Security` to every answer.
2.0 calendar (types `CalItem`, `CalDay`, `DayView`; tasks carry `repeat`, `start_date`, `moved_from`): `GET /api/calendar?from&to` (each date's tasks and events, at most 63 days),
`GET /api/calendar/[date]` (day page), `POST /api/calendar/items` and `DELETE /api/calendar/items/[id]` (event / day off), `POST /api/tasks/[id]/move {from,to}`.
3.0 templates (types `Template`, `TemplateTask`, `TemplatePreview`, `TemplatesView`; logic `lib/server/templates.ts`, samples `lib/templates/samples.ts`), every route employer only: `GET /api/templates?lang` (samples + mine, `?ref=` one), `POST /api/templates` (save as mine), `PATCH`/`DELETE /api/templates/[id]`,
`POST /api/templates/preview {tasks,start}`, `POST /api/templates/apply {source,name,lang,tasks,start}`, `POST /api/templates/week {name,from,lang}`, `DELETE /api/templates/applications/[id]`.
4.0 AI template helper (types `HouseholdProfile`, `Proposal`, `ProposalTask`, `TaskMark`, `ChatMessage`, `TplChatSummary`, `TplChatView`; logic `lib/server/tplchat.ts`), every route employer only: `GET`/`PUT /api/household`,  `POST /api/template-chats {text, base_ref?, base_name?, base_tasks?}` (new chat + first turn), `GET`/`PATCH /api/template-chats/[id]` (view; card edits `{tasks}`), `POST /api/template-chats/[id]/messages {text}`, `POST .../accept {name}`, `POST .../discard`; 5.2 `POST /api/template-chats/[id]/messages/[mid]/household` (Save to Your household, no model call; the past-chats `GET /api/template-chats` is removed); `GET /api/templates?ref=chat:<id>` returns the proposal as a `draft` template. Only `POST /api/template-chats` and `.../messages` call the model; a failed or unusable reply is `503 ai_unavailable` and saves nothing.
5.0 Kitchen (type `Dish`; logic `lib/server/kitchen.ts`): `GET`/`POST /api/dishes` (book; add `{name, photo, lang}`, anyone), `GET`/`PATCH`/`DELETE /api/dishes/[id]` (PATCH name/photo: adder or employer; favourite/note: employers; ingredients/steps: anyone; DELETE adder or employer), `POST /api/dishes/[id]/cooked` (helper, once a day). Photos go through `POST /api/photos` first.
All other writes are `route(..., { employer: true })`; `POST /api/tasks` also takes `repeat` and refuses past dates, as do items and moves.

## Data model and migrations
Source of truth: `lib/server/db.ts` (`CREATE TABLE IF NOT EXISTS`, then additive `migrate()` columns: 1.2 `entries.auto_talk_id`, `drafts.auto`; 2.0 `tasks.repeat` + `tasks.start_date`, tables `task_moves` and `cal_items`; 3.0 tables `templates`, `template_applications`, columns `tasks.application_id`, `tasks.end_date`; 4.0 column `tasks.skip_dates`, tables `household_profile` (one row), `tpl_chats` (title, base template snapshot, last `proposal` + `proposal_base` + `proposal_state`, `accepted_ref`), `tpl_chat_messages`; 5.2 `tpl_chat_messages.facts` (JSON household details an AI reply offers) and `facts_saved`).
4.0: a repeating task applied from a template skips only the first-week days that already had it (`skip_dates`, honoured in `seriesOn()`); a task already on every day it lands is not added. Proposal marks (added / changed with what / removed) are computed on read from `proposal_base` by `withMarks()`, so card edits re-mark.
5.0: tables `dishes` (name + `tr`, photo_id, favourite, note + `note_tr`, ingredients/steps + `recipe_lang` + `recipe_tr`, created_by) and `dish_cooked (dish_id, date)`; last cooked = MAX(date). Dish text is translated in the background after the write (`translateDish`, each write guarded by the text it translated) and retried when the book is opened (`fillDishTranslations`, at most every 20 s).
5.0 templates: a repeating task matching one that stops (`end_date`, a removed application) or a one-off is added with those days in `skip_dates` (`plan()` in `lib/server/templates.ts`), so re-applying after Remove brings everything back. `POST /api/templates/apply` returns before translating; `translateTask` runs in the background, `fillMissingTranslations` retries.
3.0: applying a template inserts ordinary tasks (same translation path) tagged with `application_id`; removing the application soft-removes its future one-offs and sets `end_date` on its routines, so past days and ticks stay. `end_date` is honoured in `tasksForRange()` and Today.
2.0 tasks: a one-off has `date`; a routine repeats daily, weekly (`weekdays`) or monthly (start date's day, else the month's last day) from `start_date`.
`task_moves (task_id, from_date, to_date)` moves one occurrence of a routine; occurrences are computed in `tasksForRange()` and ticks stay keyed by (task, shown date).
`cal_items` holds family events and days off (one per date). The 2.0 migration backfills old routines' `repeat` from their weekdays and `start_date` from the day they were made. Translatable rows keep the original
text + `lang` and a `tr` JSON of every household language. Entries carry a `version`; `entry_reads` stores what the helper
has seen and confirmed per version, which drives "new on Today" and "confirm again". Photos are files in `DATA_DIR/photos`.

## Auth and accounts
`lib/server/auth.ts`: argon2id (node:crypto), session tokens hashed in `sessions`, cookie `dt_session` (HttpOnly, Secure, Lax),
rate-limited sign-in/sign-up (`rate` table). Admin created at start from `APP_ADMIN_EMAIL`/`APP_ADMIN_PASSWORD`; until an
account exists sign-in and sign-up are closed. 5.4: `PUT /api/me/password` (`changePassword()`) checks the current password, saves the new hash and deletes the member's other sessions. Sign-in attempts go through `signInBlocked()`: 20 per client, 8 per login, 120 overall per 15 minutes, where the client is `clientAddress()`, the last `X-Forwarded-For` entry (set by the nearest proxy; "local" without one). 5.5: `makePasswordReset()` (owner, `POST /api/members/[id]/reset`) stores the SHA-256 of a one-time code in `password_resets` with a 24-hour expiry and deletes the member's earlier unused code; `passwordResetFor()` and `redeemPasswordReset()` back the public `GET`/`POST /api/reset` (30 lookups and 10 uses per client per 15 minutes), which set the password, delete every session of that member and sign them in. 5.6: `redeemPasswordReset()` and `signUp()` check the code or invite (and the login) before hashing the password, so a signed-out caller with a wrong code costs a lookup, not an argon2id hash that holds the server. The owner's account is never given a code: `scripts/reset-owner-password.mjs` writes the same argon2id form straight into the database. Invites: single-use codes made, listed and revoked by the admin only; each invite carries its role (employer or helper) and sign-up takes the role from the invite, never from the request (`GET /api/signup?code=` tells the form which role a code is for).

## AI
`lib/server/ai.ts`: Vercel AI SDK on any OpenAI-compatible chat endpoint. Which one (5.3): the owner's text settings from
Settings (table `ai_settings`, part `text`, all three filled) win; else `AI_BASE_URL`/`AI_API_KEY`/`AI_MODEL` from the
server environment; else none, and texts save untranslated with no error. Translation goes only into the household's
languages (`householdLangs()`: members' languages plus the helper's), plus
talk drafting and Notebook matching (new / merge / replace), each draft flagged `critical` or not. Critical drafts are
auto-saved by `autoSave()` in `lib/server/household.ts` (API: `Entry.auto_from`, `Draft.auto`). Keys never leave the server.
Private notes never go to the model.
4.0 `templateChatTurn()`: the household profile, the last 10 messages (600 chars each), the template or last proposal being changed (tasks numbered, model returns `from` per task) and the new message (≤1000 chars); replies JSON `question | proposal | offtopic`, in the message's language (any Chinese character = 中文). `lib/server/tplchat.ts` tidies the tasks (times, repeats) and the off-topic line is fixed text. 5.2: `homeContext()` adds employers' names, saved template names, ≤30 calendar tasks from today (time, title, repeat) and ≤20 house-rule titles; the reply may carry `household` facts, which `cleanFacts()`/`newFacts()` reduce to what the profile lacks and store on the AI message; `getChat()` re-checks offers against the profile on every read, and `saveFacts()` merges without overwriting.

5.3 owner settings (`lib/server/aisettings.ts`, `GET`/`PUT /api/ai-settings`, admin only, 403 `admin_only` for anyone
else): PUT saves first, then checks each part sent with one small call (a one-token chat completion; 0.5 s of silence to
`audio/transcriptions` or DeepSeek's `tools/asr`) and reports `ok` or `unreachable` / `key` / `model` / `other` (status only, never the
provider's body). A key is never returned, only `key_hint` (`…` + last 4). Keys sit in plain text in the SQLite file.
5.3 back-fill (`lib/server/backfill.ts`, table `household_langs (lang, added_at, backfilled_at)`): when a language joins
(sign-up, `PATCH /api/me`, once per server start) entries, tasks, dishes and upcoming events are translated into it one
at a time; each write merges into the stored JSON after checking the text is unchanged, so a restart resumes safely.
Talk lines are not back-filled.

## Listening (1.9; 5.3)
`lib/client/recorder.ts` (`HoldCapture`) records with `MediaRecorder` only while Hold to talk is held and stops every mic
track on release. `toWav` decodes the recording (Safari audio/mp4, Chrome audio/webm) at 16 kHz into mono 16-bit WAV,
at most 118 s. The WAV goes once to `POST /api/listen` (form: audio, lang, talkId; employers; not stored).
`lib/server/listen.ts` posts it as `file` with `model` and `language` to `{base}/audio/transcriptions` (OpenAI style),
or, when the address ends in `/tools/asr` (DeepSeek), as `file` alone to that address,
using only the owner's speech settings; without them it answers 503 `listen_unavailable`, `Me.speech` is false and Talk
hides Hold to talk. When the talk has lines, `cleanTranscript` in `lib/server/ai.ts` (text AI) fixes clearly misheard
words from the last 5; a failed cleanup keeps the transcript. The text then goes to `POST /api/talks/:id/lines` like a
typed line. The phone's own SpeechRecognition is not used: on iPhone it heard only the first hold.

## Background jobs
In-process only: translating dishes (5.0) and applied template tasks, drafting a talk (`startDrafting`, also for talks quiet for 5 minutes) and retrying failed translations (`fillMissingTranslations`).

## Client state
`lib/client/i18n.tsx` (MeProvider: user, language, originals toggle, badges, toasts), `lib/client/useApi.ts`, `lib/client/recorder.ts`
(hold-to-talk capture). There is no speech synthesis (removed in 1.2). Strings per screen in `lib/strings/*.ts`, keyed by language code.

## Release packaging
`pnpm build && pnpm release` (`scripts/release.mjs`): Next standalone → `release/server` with `server.mjs` (PORT, HOST,
DATA_DIR), static copy → `release/site`; `RELEASE_DIR=<folder>` writes elsewhere. pnpm `nodeLinker: hoisted` so the
package holds real files, never symlinks. `pnpm start` runs `release/server/server.mjs`. Two scripts ship beside it:
`hold-records.mjs` and `reset-owner-password.mjs` (5.5).

## Privacy (5.3)
A helper sees no talk created before her account (`listTalks`, latest, today, day pages, search; a direct GET is 404).
Entries drafted from such talks stay readable but lose their link to the talk. Employers see every talk.

## Invariants
- Nothing reaches the helper until an employer approves a draft; the talk API hides drafts from her.
- Private notes are returned only to their owner and never sent to the model.
- A helper never receives a talk from before she joined; a saved AI key never leaves the server in full.
- Languages are `lib/languages.ts`; screens and data key by its codes.

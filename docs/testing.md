# Testing

- Typecheck: `pnpm typecheck`. Lint: `pnpm lint`. Build: `pnpm build && pnpm release` (writes `release/`).
- Server tests (5.3): `pnpm test` runs `lib/server/test/*.test.ts` (helper talk privacy; ai-settings owner only and the
  key never returned; back-fill merge and resume against a local fake endpoint; 5.4 `account.test.ts`: password change and
  the sessions it ends, the client address taken from the last `X-Forwarded-For` entry, the three sign-in limits; 5.5 a reset code used once,
  replaced, expired and for a removed member, and `scripts/reset-owner-password.mjs` run against the test database; 5.6 no hashing for a wrong reset code or invite, and
  `uploads.test.ts`: an oversized photo upload refused while it arrives, with or without a declared length). No network.
- Seed: `DATA_DIR=$(mktemp -d) pnpm seed:review` (refuses in production) prints the demo sign-ins and an unused invite code.
- Calendar (2.0): the seed gives this month a weekly ironing routine (Tue, Fri), a monthly fridge clean (started on a 31st, so it falls on the 30th in 30-day months), Grandma's birthday dinner two days ahead, her day off on the next Sunday, the next ironing day moved to the following Monday, and three days ago a full day page (a talk, a private and a shared note, a Notebook entry, ticks). Seeded routines start 20 days back.
- Review session: `node scripts/review-session.mjs` starts the built app on a temp data dir, seeded, and prints the origin.
- Flow check: `node tools/flows.mjs` (Playwright from `PLAYWRIGHT=<module path>`, else any `*_PLAYWRIGHT` variable, else the `playwright` package) walks Talk's text box (send, blank, double tap), the Burmese keyboard, approving a
  contradicting draft, the helper's Today/confirm/tick with reload, questions, invites, desktop Talk/Notebook, and (2.0) Calendar month/week, a day page, Add and Move as employer and the helper's read-only Calendar and Tomorrow, and (3.0, `FLOWS_ONLY=templates`) open Baby care, edit/remove a task, preview, put on calendar, remove its tasks; save as mine and save a week; 中文 samples; helper refused. Seed adds Mei's saved template 周末大扫除 under My templates. 4.0 (`FLOWS_ONLY=ai`): Calendar's AI entry, chat box above Samples, no Past chats or chat links, Change with AI on every My templates row (none on samples) landing on the template with its ask box focused and in view (5.2); a real proposal for the seeded household (checked for Grandma and cat, no baby/dog/garden), a time fixed on the card, Accept; a real change to Laundry week (marks, removed, sample unchanged); AI unreachable (503 routed on the Templates box) keeps the message; 5.2: Your household's lead and Who-lives-here lines, a real chat mentioning a goldfish offers Save to Your household, the tap saves it once (reload shows Saved, no button; cat and Grandma still there), no helper name in the chat; a History talk with waiting points shows them above the lines at 390; Mei in 中文 and the shared profile; helper refused. Seed (4.0) fills the household profile (2 adults, Grandma 82, Leo 3, a cat, 3 bedrooms, no garden) and one accepted chat (question, answer, proposal saved as "Our week with Grandma and Leo"; no longer listed since 5.2). The seed's helper is Mya (`mya` / `mya-review-123`).
- Kitchen (5.0, `FLOWS_ONLY=kitchen`): the admin (Daniel) at 390 and Mei at 1280 add a dish from a 4032×3024 camera-size JPEG (over 8 MiB, shrunk on the phone) and a name, the card lands first, Show fills the screen and reads the seeded dish's Burmese name, Close; Mya reads the note in Burmese, has no star, taps Cooked today (reload keeps it), sort, Favourites, a search with no match. History opens from Talk and from her Today with the previous tab current. Seed (5.0) adds four dishes with photos from `design/seed/`: Hainanese chicken rice (favourite, note "Less salt…", cooked 3 days ago), Mohinga by Mya (recipe in Burmese, cooked 10 days ago), 番茄炒蛋 by Mei (cooked last week), Garlic kailan (never cooked); a missing seed photo is warned and the dish has none.
- Talk 5.1 (`FLOWS_ONLY=5.1`): no New talk or Last talk; a sent line's bin sits level with the speaker line, 44px, clear of the words; tapping the words still opens Save correction; bin a text row, a photo row and a row still translating (it stays gone after 12 s and a reload); other rows and the auto-added note stay; on a History talk bin every row (a talk of photo rows made by the flow), it leaves History and its URL lands there; the helper sees no bin and gets 403; with the browser clock on tomorrow, Talk is blank (picture, one line, no rows or notes, Past talks count kept) and the first line shows under This talk. The seed keeps its Talk talk on today even just after midnight.
- The whole flow file signs in more than 20 times, over the sign-in rate limit (20 per 15 min per client, 8 per login), so later flows time out at sign-in in one run: walk it in groups with `FLOWS_ONLY` (each run starts a fresh server).
- AI calls use the AI_* values in the environment. Listening (1.9): every flow gets `fakeMic` in tools/flows.mjs (a fake
  `getUserMedia` and `MediaRecorder`; `window.__silentNext = true` makes the next hold record nothing) and answers
  `/api/listen` itself (and reports `Me.speech` true, 5.3; the `5.3` flows use the server's real answer) with "<tag> words in en-US|zh-CN <n>", so no speech-to-text call is made; uploads must be
  `hold.wav` WAV files. It walks five holds in a row, a silent hold and one more under iPhone Safari and iPhone Chrome user agents
  (mic closed after every hold; every hold after the first sends the talk id), a hold record read back through the
  team's script, holds through 中文 / English switches, the iPhone mic tip, and a browser with no recorder
  (`FLOWS_ONLY=iphone` runs the iPhone and record flows). A simulated pass is not proof on a phone: a live hold needs
  a real iPhone. Speech to text is checked live (signed in, POST a short WAV to /api/listen).

## Reading the silent hold records (1.4)
Nobody has to do anything: each phone sends them as it uses Talk. On the deployed server either
- the server log: every record is one line starting `[hold-record] ` followed by JSON (time, user id, page-load id,
  user agent, events…), or
- the database: `cd release/server && DATA_DIR=<data folder> node hold-records.mjs --user <sign-in name> --hours 24`
  (in a checkout: `DATA_DIR=<copy of the data folder> node scripts/hold-records.mjs`). It prints, oldest first and grouped by
  page load, each load of Talk and each hold with its outcome, when it really started listening, any
  wait for the previous recogniser, and every event with ms since the press. `--json` prints one JSON object per line.
From 1.5 each hold also prints `went: HEARD|DEAF`; records before 1.9 also print every start's ms, warm or cold.

(1.8's owner-only `GET /api/holds` was removed in 5.3; records are read only from the server.)
Reading a failing hold (1.9): no `micOpen` means the microphone never opened (see the `error`); `recorded` with 0 bytes
means nothing was recorded; `recorded` with bytes but no `heard` means /api/listen failed (the `error` names it, and
the server log has a `[listen]` line). No screen, route or role reads them back; they hold no audio.

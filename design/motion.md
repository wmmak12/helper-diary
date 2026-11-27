# Helper Diary: motion (Ink & Ribbon)

**Personality: ink settles.** Things are written onto the page, not thrown at it. Motion is short, eases out
like a pen lifting, and always says what happened: you are heard, it was written down, this changed, it is done.
Nothing loops for decoration, nothing bounces except the ribbon's one small settle.

Build with CSS transitions first and Motion (`motion/react`, loaded through `LazyMotion` with `domAnimation`)
where a sequence, a gesture or a layout change needs it. Animate `transform` and `opacity` only, except the
few one-element exceptions named below. Everything must stay smooth on an ordinary phone at 390px wide.

## Tokens

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 80ms | Press feedback, colour of a held button |
| `--dur-fast` | 140ms | Hover, toggles, checkbox fill, badge change |
| `--dur-base` | 220ms | Lines and rows entering, banners, toasts, tab change |
| `--dur-write` | 360ms | Ink write-in of a line, pen stroke through a task |
| `--dur-slow` | 420ms | Ribbon drop, sheets, drill-in page |
| `--ease-ink` | `cubic-bezier(0.22, 1, 0.36, 1)` | Default: everything entering or writing |
| `--ease-settle` | `cubic-bezier(0.34, 1.32, 0.64, 1)` | The ribbon only (one small overshoot) |
| `--ease-turn` | `cubic-bezier(0.65, 0, 0.35, 1)` | Pages turning, sheets leaving |
| exit | 0.7 × the entry duration, `ease-in` | Anything leaving |

Distances: 8px for lines and rows, 16px for tabs, 24px for drill-in pages. Never more than 24px.

## The ink write-in (shared primitive)
Used for new transcript lines, approved entries and saved notes.

- The line's text is revealed from the start of the line to its end (left to right for all three languages).
  Implementation: a `paper`-coloured cover over the text block, `transform: scaleX(1 → 0)` with
  `transform-origin: right`, over `--dur-write` with `--ease-ink`. The text underneath fades `opacity 0 → 1`
  over the first 120ms and moves 8px from the start side, so it reads as ink settling, not a curtain.
- Multi-line text reveals as one block (no per-word or per-letter stagger: Burmese clusters must never be
  split).
- Under reduced motion: an opacity fade of `--dur-fast`.

## Hold to talk
The flow that must feel great. It answers in the same frame as the touch.

| Moment | What moves | Timing |
|---|---|---|
| Press (`pointerdown`, or Space held) | The button sinks: `translateY(2px) scale(0.985)`; fill `primary → ribbon-ink`; label becomes "Listening · let go to send" (in the speaker's language); mic icon swaps to a filled dot. `navigator.vibrate(10)` where supported. | `--dur-instant`, label swaps instantly |
| While held | A ring around the button (a pseudo-element) scales with the microphone level, `scale(1 + level × 0.08)`, opacity .35, updated per animation frame. An elapsed timer (`0:04`, tabular figures) shows in the button. If no level data arrives, the ring breathes `opacity .2 ↔ .45` every 1.2s so it never looks frozen. | Per frame |
| Release | Button rises back, fill returns to `primary` (fill change is the one exception to transform/opacity, on one element). Label returns to "Hold to talk". The ring collapses `scale → 1, opacity → 0`. A new transcript row appears at once with the spoken text area showing three ink dots ("Translating…" for screen readers). | `--dur-fast` |
| Released too soon (under 400ms) | Nothing is sent. A hint fades in under the button, "Hold the button while you speak", and fades out after 3s. | `--dur-base` |
| Slide off (finger moves more than 64px from the button) | The ring fades and the label becomes "Let go to cancel"; letting go there cancels and nothing is saved. Coming back resumes. | `--dur-fast` |
| Translation arrives | See "From the speaker's side" below. The read-aloud button's sound waves fade in and out (opacity) while it is speaking, and the Burmese line being read gets a `ribbon-wash` background faded in. | `--dur-base` |
| Error (mic blocked, offline, translation failed) | The pending row turns into an inline notice on `danger-wash` in both languages, sliding 8px down and fading in. The row keeps whatever text was captured. No shake. | `--dur-base` |

The listening state must never depend on motion: colour, label, the filled dot and the timer all say it, so
under reduced motion the ring is a static 2px `ribbon` outline and the timer still counts.

## From the speaker's side
On the shared phone the employer speaks with Hold to talk (the end side, right) and the helper types with the
keyboard button (the start side, left). Each new item enters from its speaker's side:

- **Employer's line:** the original writes in (ink write-in). Then, 120ms later, the Burmese translation block
  enters from the end side: `translateX(16px) → 0`, opacity `0 → 1`, `--dur-base`, `--ease-ink`.
- **Helper's typed reply:** her Burmese writes in. Then the English or 中文 translation enters from the start
  side: `translateX(-16px) → 0`, same timing.
- Rows already on the page shift with a Motion `layout` animation (`--dur-base`) to make room, never jump.
- Under reduced motion: both blocks fade in (`--dur-fast`), with no movement.

## New transcript lines
Every line added to a talk (spoken, typed, or a misheard line corrected by the employer) uses the ink write-in.
After an edit to a misheard line, the corrected text writes in again and its translation re-enters from its
speaker's side, so both people see that the translation followed. A list of saved talks (Talks) does not
animate on load: only rows that arrive while you are looking enter, with an 8px rise and fade.

## The ribbon drops onto what changed
- The ribbon hangs from the top edge of the one item that changed: a Notebook entry changed since she last
  opened it, the newest answer to her question, the approved entry, the current tab.
- It drops `translateY(-100%) → 0` over `--dur-slow` with `--ease-settle`, then settles with a 1.5° rotation
  back to 0 over 160ms. One ribbon per screen; when it moves to another item, it lifts (`translateY → -100%`,
  `--dur-fast`, ease-in) and drops onto the new one.
- On Today the changed entry's row also has a `ribbon-wash` background that fades out over 600ms once she has
  opened and confirmed it. The ribbon stays until then.
- The tab marker uses the same shape and slides between tabs (`layoutId`, `--dur-base`, `--ease-ink`).
- Under reduced motion: the ribbon appears in place with a `--dur-fast` fade, and moves by fading.

## A ticked task gets a pen stroke
- Tick: the checkbox fills `primary` and its check draws itself (SVG `stroke-dashoffset`, `--dur-fast`). Then
  a 2px `ink` stroke is drawn through the task text from start to end over `--dur-write` with `--ease-ink`,
  following each wrapped line (an inline span with a `linear-gradient(currentColor, currentColor)` background,
  `background-size` animated from `0% 2px` to `100% 2px`, `box-decoration-break: clone`: a one-element
  exception). The text colour eases to `muted`.
- The row stays where it is for 1s, then moves down to the "Done" part of the list with a `layout` animation
  (`--dur-slow`, `--ease-turn`), so she can still undo by tapping it again.
- Untick: the stroke retracts end to start in `--dur-fast`, the text returns to `ink`, the row stays.
- The employer's progress line ("3 of 5 done") updates its number at once and its thin ink rule grows
  `scaleX` with `--dur-base`.
- Under reduced motion: the check and the stroke appear at once (no draw), and the row moves by fading out
  and in.

## Screen transitions show where things went
- **Between tabs** (Talk, Talks, Notebook, Today): the outgoing page fades out (`--dur-fast`), and the new
  page fades in and moves 16px from the side of its tab: from the right when the tab is to the right of the
  current one, from the left when it is to the left. The ribbon marker slides to the new tab.
- **Into a detail** (a talk, a Notebook entry, a question, a note): the detail page enters from the end side
  `translateX(24px) → 0` with fade, `--dur-slow`, `--ease-ink`; the list behind it dims slightly (opacity .6).
  Back reverses it with `--ease-turn`. Where the item has a title, the title is a shared element (`layoutId`)
  that moves from its row into the page header.
- **Sheets** (edit entry, invite, the merge-or-replace comparison): rise from the bottom `translateY(100%) → 0`
  over `--dur-slow`; the `ink` scrim fades to 40%. Leaving: `--dur-base`, `--ease-turn`. Dialogs: fade and
  `scale(0.98) → 1`, `--dur-base`.
- **Loading to content:** skeletons are faint ruled lines (`rule` bars) whose opacity breathes .5 ↔ .9 every
  1.4s; content replaces them with an opacity cross-fade (`--dur-base`). No spinner except inside a button
  that is busy (three ink dots).
- **Toasts:** rise 8px from above the tab bar and fade in, `--dur-base`; stay 4s, or until dismissed if they
  carry an action or an error.

## Micro-interactions
- Press on any button: `scale(0.98)` and the pressed colour, `--dur-instant`. Hover (pointer devices only):
  background tint, `--dur-fast`.
- Language switch (English / 中文): the selected pill's `primary` fill slides between options (`layoutId`),
  `--dur-base`.
- Original toggle (မူရင်း): the original text cross-fades in place of the translation, `--dur-base`; the
  height change follows with `layout`.
- Badge count on Talks: when the number changes, it pops `scale 1 → 1.15 → 1` over `--dur-fast`.
- Field validation: the message fades in under the field (`--dur-fast`) and the border turns `danger`. No
  shake.
- Copy invite code or link: the copy icon swaps to a check that draws itself, and "Copied" replaces the label
  for 2s.
- Pinned Notebook items (Purpose, emergency contact) do not animate on load; the Purpose page's ribbon is
  already in place.

## The one celebratory moment: approving a draft into the Notebook
When an employer approves a drafted instruction (on Talks, or in "From this talk" on desktop), it is written
onto its page and the ribbon settles on it. Total under 1.1s, and it never blocks the next action: the other
drafts stay usable throughout.

1. **0ms:** Approve is pressed. The button's label becomes a check that draws itself (`--dur-fast`).
2. **80ms:** the draft's `ochre-wash` background and `ochre` left rule fade to `paper` (`--dur-base`). The
   "Draft" label fades out and "Notebook · Instructions" (the section it went into) fades in, in `muted`.
3. **160ms:** the Burmese text of the entry writes in with the ink write-in (`--dur-write`), as if newly
   written in her book.
4. **520ms:** the ribbon drops onto the entry and settles (`--dur-slow`, `--ease-settle`).
5. **~1000ms:** the entry holds for a moment, then leaves the drafts list by collapsing its height
   (`layout`, `--dur-base`), and a toast appears: "Added to the Notebook" with an Open action.

If the approved draft contradicts an existing entry, there is no celebration at the press: the merge-or-replace
sheet rises instead, and the sequence above plays when the employer chooses Merge or Replace. On the helper's
Today the changed entry arrives with its ribbon and `ribbon-wash` row, as described above.

Under reduced motion: the check appears, the background changes and the label swaps at once, the ribbon
appears with a fade, and the toast fades in. The meaning (approved, filed in the Notebook, marked) is all
still shown.

## Reduced motion
Under `prefers-reduced-motion: reduce` every movement becomes an opacity fade of `--dur-fast` or an instant
change. Nothing autoplays or loops except the listening timer.

| Motion | Reduced |
|---|---|
| Hold to talk sink, level ring | Instant colour, label and dot change; static ring outline; timer still counts |
| Ink write-in | Fade |
| Translation from the speaker's side | Fade, no slide |
| Ribbon drop and settle | Fade in place |
| Pen stroke through a task | Stroke and check appear at once |
| Tab and drill-in transitions | Cross-fade, no slide |
| Sheets | Fade, no rise |
| Skeleton breathing | Static faint lines |
| Badge pop | Instant number change |
| Celebration | Instant states, ribbon fade, toast fade |

Implement with a `MotionConfig reducedMotion="user"` at the root plus a CSS
`@media (prefers-reduced-motion: reduce)` block that swaps transitions to opacity for the CSS-only pieces.

## Performance
- `transform` and `opacity` only, except the three named one-element exceptions (Hold to talk fill, the pen
  stroke's `background-size`, the drawn check's `stroke-dashoffset`).
- The microphone level ring is updated with `requestAnimationFrame` on a single element through a CSS
  variable, not React state. It stops when the button is released and when the tab is hidden.
- `motion/react` is loaded with `LazyMotion` and `domAnimation`. No other animation library is needed.
- No list animates more than the rows that changed; long lists (Talks, Notes) never stagger on load.

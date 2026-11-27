# Helper Diary: style (Ink & Ribbon)

The owners picked direction 1, Ink & Ribbon (`design/directions/1`). Every later screen and image follows this file.
Level: **Nicely branded**. Mood: warm and calm, like a tidy home notebook; respectful, never childish, never
corporate.

**The idea in one line:** every screen is a page of one good cloth-bound household book, written in navy ink,
with times in a rose margin and one rose ribbon marking what matters.

Reference pictures: `design/directions/1/tile.png` (the picked tile), with `brand.png` and `icon.png` in that
folder. Brand files: `design/manifest.json`.

## Principles
- **The helper's language is never second.** Burmese gets the same serif family, the same page and at least
  the same size as the employer's English or 中文. It is never a grey subtitle and never smaller.
- **One paper, one ink.** Pages are paper on a desk. Ink is navy. Colour means something: rose for the
  ribbon (new, pinned, the screen you are on), ochre for drafts, moss for done, brick red for errors.
- **One ribbon per screen.** It marks the single thing that changed or matters most there.
- **Quiet, then large where it counts.** The biggest things on a screen are the Hold to talk button and the
  Burmese line being read, never decoration.
- **Familiar parts.** Bottom tabs on the phone, a sidebar from 1024px, plain checkboxes, plain text fields.
  The brand lives in paper, ink, rules, type and the ribbon, not in invented controls.

## Palette
Light theme only in 1.0: the paper is the identity. There is no dark theme.

| Token | Hex | Role |
|---|---|---|
| `desk` | `#EFE6D6` | App background behind pages; phone tab bar |
| `paper` | `#FBF7EF` | Page surface: lists, entries, sheets, inputs |
| `rule` | `#E4D8C4` | Ruled lines and hairline borders (decorative, never the only edge of a control) |
| `margin` | `#D8A29F` | The vertical margin line on ruled pages (decorative) |
| `ink` | `#1F2A44` | Body text, headings, checkbox borders, focus ring |
| `muted` | `#5A6072` | Secondary text: times, speaker names, hints. Never over the hero image |
| `primary` | `#24345C` | Hold to talk, primary buttons, ticked checkbox fill |
| `primary-press` | `#172340` | Primary pressed |
| `on-primary` | `#FBF7EF` | Text and icons on primary, ribbon-ink, ochre-ink, moss and danger fills |
| `ribbon` | `#C0646B` | The ribbon bookmark, the active-tab marker, the "new" dot. Fills and marks only, **never behind text** |
| `ribbon-ink` | `#8E3A41` | Listening state of Hold to talk; rose text (labels such as "New", "Purpose") |
| `ribbon-wash` | `#F5E3DF` | Background of what changed (new entry on Today, highlighted line being read aloud) |
| `ochre` | `#B7791F` | Draft marks: left rule of a draft, the draft dot |
| `ochre-ink` | `#7E5210` | Draft labels, the helper's name, badge fill (count on Conversations) |
| `ochre-wash` | `#F6EBD6` | Background of a draft waiting for approval |
| `moss` | `#4C6838` | Done, confirmed, "Understood" |
| `moss-wash` | `#E6EBDD` | Background of a confirmed notice |
| `danger` | `#A33A2E` | Errors, destructive actions |
| `danger-wash` | `#F7E2DC` | Error banner background |
| `field` | `#787D8B` | Input and select borders, unticked-checkbox ring on desk (3:1 graphic) |

### Tailwind tokens
```css
@theme {
  --color-desk: #EFE6D6;
  --color-paper: #FBF7EF;
  --color-rule: #E4D8C4;
  --color-margin: #D8A29F;
  --color-ink: #1F2A44;
  --color-muted: #5A6072;
  --color-primary: #24345C;
  --color-primary-press: #172340;
  --color-on-primary: #FBF7EF;
  --color-ribbon: #C0646B;
  --color-ribbon-ink: #8E3A41;
  --color-ribbon-wash: #F5E3DF;
  --color-ochre: #B7791F;
  --color-ochre-ink: #7E5210;
  --color-ochre-wash: #F6EBD6;
  --color-moss: #4C6838;
  --color-moss-wash: #E6EBDD;
  --color-danger: #A33A2E;
  --color-danger-wash: #F7E2DC;
  --color-field: #787D8B;

  --font-serif: "Newsreader", "Noto Serif SC", "Noto Serif Myanmar", Georgia, serif;
  --radius-page: 6px;

  --ease-ink: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-settle: cubic-bezier(0.34, 1.32, 0.64, 1);
  --ease-turn: cubic-bezier(0.65, 0, 0.35, 1);
}
@layer base {
  html { font-family: var(--font-serif); color: var(--color-ink); background: var(--color-desk); }
  :lang(my) { font-family: "Noto Serif Myanmar", serif; line-height: 1.95; }
  :lang(zh-Hans) { font-family: "Noto Serif SC", serif; line-height: 1.65; }
}
```
Motion durations live in `design/motion.md`.

### Contrast (computed in code, WCAG 2.x)
Text pairs need 4.5:1; control edges and meaningful marks need 3:1.

| Pair | Ratio |
|---|---|
| ink on paper | 13.34 |
| ink on desk | 11.51 |
| muted on paper | 5.86 |
| muted on desk | 5.06 |
| on-primary on primary (Hold to talk) | 11.42 |
| on-primary on primary-press | 14.55 |
| on-primary on ribbon-ink (Listening) | 6.94 |
| ribbon-ink on ribbon-wash | 5.98 |
| ink on ribbon-wash | 11.50 |
| muted on ribbon-wash | 5.05 |
| ochre-ink on paper | 6.34 |
| ochre-ink on ochre-wash | 5.73 |
| on-primary on ochre-ink (badge) | 6.34 |
| muted on ochre-wash | 5.30 |
| moss on paper | 5.88 |
| moss on moss-wash | 5.17 |
| on-primary on moss | 5.88 |
| danger on paper | 6.14 |
| danger on danger-wash | 5.27 |
| ink on danger-wash | 11.45 |
| on-primary on danger | 6.14 |
| primary on paper / on desk | 11.42 / 9.86 |
| ink on the hero's calm side (darkest pixel `#F3D4B2`) | 10.10 |
| muted on the hero's calm side | **4.44: fails, so text over the hero is ink only** |
| Graphic: ribbon on paper / on desk | 3.72 / 3.21 |
| Graphic: ochre on paper | 3.41 |
| Graphic: field border on paper / on desk | 3.85 / 3.32 |
| Graphic: ink checkbox border, focus ring on paper | 13.34 |

`ribbon` (`#C0646B`) behind text measures 3.72 with paper text and fails, which is why it is marks only.
Semi-transparent colours are not part of the palette; if one is introduced, composite it over its real
background and add the pair here.

## Type
One serif voice across all three scripts.

| Script | Family (Google Fonts) | Weights | Line height |
|---|---|---|---|
| Latin | Newsreader (optical sizes) | 400, 500, 600, italic 400 | 1.4 body, 1.15 display |
| Simplified Chinese | Noto Serif SC | 400, 600 | 1.65 |
| Myanmar | Noto Serif Myanmar | 400, 500, 600 | **1.95 running text, 1.8 minimum anywhere** |

Stack: `"Newsreader", "Noto Serif SC", "Noto Serif Myanmar", Georgia, serif`. Every Burmese string is wrapped
in `lang="my"` (and Chinese in `lang="zh-Hans"`), so `:lang(my)` puts it in Noto Serif Myanmar at its line height.

**Burmese never clips.** Stacked medials and vowels sit above and below the line. Never put Burmese in a box with
a fixed height, `overflow: hidden` or `line-height` under 1.8. Give buttons with Burmese labels a min-height
and vertical padding (at least 10px) rather than a fixed height. Truncate with `line-clamp` only at 1.95 line
height. Burmese words are long, so allow buttons to wrap onto two lines rather than shrink the type. Small caps
and letter-spacing apply to Latin labels only; Burmese labels stay normal case at 15px or more.

### Scale (px, read at arm's length; nothing below 13)
| Use | Latin / 中文 | Burmese |
|---|---|---|
| Page title (Talk, Notebook, ယနေ့) | 34 / 600 | 30 / 600 |
| Section heading | 24 / 600 | 22 / 600 |
| Translation being read on Talk | n/a | 24–26 / 500 (`clamp(24px, 6.4vw, 26px)`) |
| Spoken line on Talk, entry title | 20–22 / 500 | 20–22 / 500 |
| Body, list rows, task text | 18 / 400 (never smaller) | 18 / 400 |
| Hold to talk label | 24 / 600 | 22 / 600 |
| Buttons | 17 / 500 | 17 / 500 |
| Secondary (times, speaker, hints) | 15 / 400 | 15 / 400 |
| Labels (section eyebrows, tags) | 13–14 small caps, tracking .06em | 15 / 500 |

Figures in times and counts use `font-variant-numeric: tabular-nums`.

## Shape, line and depth
- Radius: `6px` for pages, buttons, inputs and sheets; full pill for the language switch (English / 中文) and
  count badges; `3px` for the ribbon's top and checkboxes.
- Lines: 1px hairlines in `rule` between rows and around pages. Controls take a 1.5px `field` or `ink`
  border so their edge reaches 3:1.
- **No drop shadows.** A page sits on the desk with a single 1px `rule` edge. Sheets and dialogs sit on a
  `ink` scrim at 40% opacity, not a shadow.
- Ruled pages (Talk transcript, History, Notebook, Today): paper with a 1px `margin` line at 48px from the left,
  and a 1px `rule` line under each row (entry, line, task), so lines always follow the text. Only the blank space
  after the last row of a transcript is ruled every 32px (`.ruled-tail`). Times sit in the margin column in
  `muted` 15px tabular figures, ending at least 3px before the margin line.
- The ribbon: a `ribbon` strip 12–16px wide, square-topped, with a V-notched tail (`clip-path: polygon(0 0,
  100% 0, 100% 100%, 50% 78%, 0 100%)`), hanging from the top edge of what it marks.
- Focus: 2px `ink` outline with 2px offset on every focusable control, never removed.

## Spacing and layout
- 4px base. Page gutter 16px on phone, 24px from 640px, 32px from 1024px. Reading column at most 720px.
- Touch targets at least 44×44px; primary buttons 52px tall; **Hold to talk 92px tall** and full width on
  phone, beside a 92px-tall keyboard button labelled in Burmese.
- Phone: one column, bottom tab bar on `desk` (Talk, Talks, Notebook, Today), active tab marked by a short
  `ribbon` strip above its icon plus `ink` label; inactive labels in `muted`. Badge counts in an `ochre-ink`
  pill.
- From 1024px: a 240–256px sidebar on `desk` with the logo, the same destinations and the ribbon marker on
  the current one; pages centred on the desk. Talk shows "From this talk" drafts in a right column.
- The helper's screens are laid out exactly like the employers'; only the language changes. The "original"
  toggle (မူရင်း) sits in the page header, one tap away.

## Interface icons
lucide (`lucide-react`), kept as code, never generated. Stroke 1.75 (2 on primary buttons), 20px in lists,
24px in tabs and buttons, colour `currentColor`. Core set: `Mic` (talk), `Keyboard` (type), `Volume2` (read
aloud), `MessagesSquare` (Talks), `BookOpen` (Notebook), `ListChecks` (Today), `Check`, `Pin`, `Phone`,
`HelpCircle` (questions), `Pencil`, `X`, `Eye` (original), `Settings`, `UserPlus` (invite), `WifiOff`,
`MicOff`, `RotateCcw` (try again). No emoji anywhere in the interface.

## Images
All brand art is in `design/brand/`, listed with sizes and uses in `design/manifest.json`. Text is never in an
image; names and wordmarks are set in Newsreader.

- **Logo:** `logo.png` is the lockup (mark plus "Helper Diary", transparent). In the app header, set the
  mark (`logo-mark.png`, cropped to the book) at 28–32px tall beside the wordmark in Newsreader 600, `ink`.
- **Hero** (`hero.png`): sign-in and welcome. From 1024px it fills the page with the form on its calm right
  side. On a phone it is a top band, `object-fit: cover; object-position: 28% 62%`, about 240px tall, with the
  form on paper below. Text over the hero is `ink` only.
- **Empty states** (`empty-*.png`, transparent): 160px wide on phone and 200px from 1024px, centred above a
  heading, one line saying what belongs here, and the action that fills it.
- **New art** starts from the style prompt below and passes `design/directions/1/tile.png`,
  `design/directions/1/brand.png` and the closest existing file in `design/brand/` as references.

### Illustration style prompt (start every image prompt with this)
> Fine pen-and-ink line drawing with a light, restrained watercolour wash, on warm cream paper with visible
> paper grain; navy-blue ink lines, washes of warm ochre, soft rose and muted moss green; calm, adult, editorial
> book-illustration feel, generous white space. No text, no letters.

Spot art adds: "on a fully transparent background, an isolated vignette with soft watercolour edges that fade
out, no backdrop". Recurring objects: the navy cloth notebook with the rose ribbon, a fountain pen, tea in a
plain cup, jasmine, a wooden kitchen table, morning light. People appear only as hands, if at all.

## Avoid
- Rose (`ribbon`) behind text, more than one ribbon on a screen, or the ribbon used as plain decoration.
- Drop shadows, glassy blur, gradients in the UI, card grids of identical rounded cards.
- Inter, system UI fonts or a sans for body text; handwriting fonts anywhere.
- Burmese smaller, lighter or greyer than the language beside it; Burmese in fixed-height boxes.
- Skeuomorphic leather, page curls, stitched edges, paper-tear effects.
- Chat bubbles: Talk is a ruled transcript, not a messenger.
- Cute or childish art: no mascots, no cartoon faces, no confetti, no emoji. The duck in the hero stays small.
- Corporate dashboard looks: stat tiles, charts for the day's progress (use a plain "3 of 5 done" line with a
  thin ink progress rule).
- Placeholder or stock images; any image with text in it.

## Components
Components: none

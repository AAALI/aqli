# Handoff: Aqli v3 — knowledge-first redesign

## Overview

Aqli is a docs product for teams where both humans and AI agents write. **v3 is a
full redesign of the app**, not a feature. Its thesis is subtraction: the old
design spent ~70% of its screens on review process and admin, and the writing
surface was ringed with metadata. v3 strips the writing surface to a paper
column and a cursor, collapses four doc statuses into one three-state dot, cuts
onboarding from five screens to three, and deletes four routes outright.

What ships:

- **3-screen onboarding** → first run → cursor. Target: first keystroke inside
  60 seconds.
- **Writing surface with nothing on it** — no rail, no badges, no status, no
  owner, no doc-type picker. `/` for structure, `⌘J` for the one AI affordance,
  `⌘⏎` to publish.
- **All process moved into the Publish sheet** — space, type, who should check
  it. A writer who never publishes never sees any of it.
- **One status system everywhere**: Current · Ageing · Unverified.
- **Reading surface** with a trust line and one *collapsed* rail (Outline /
  Cited by / History).
- **Nine destinations** instead of twenty-eight.

Existing repo: `AAALI/aqli` (branch `main`) — Next.js App Router. This is a
redesign *of that codebase*; see §11 for the file-by-file map of what to change.

---

## About the design files

The files in this bundle are **design references created in HTML** — prototypes
of intended look and behaviour, not production code to copy. The task is to
**recreate them inside `AAALI/aqli`'s existing environment** (Next.js + React +
Tailwind/`app/globals.css` tokens), using its established components and
patterns. Where a v3 screen replaces an existing route, rebuild that route; do
not add v3 alongside v1.

`aqli-v3.css` is the most useful artifact — it is a plain token + class sheet
whose colour and type values were taken from the shipped app's
`app/globals.css`, so tokens should map 1:1. Treat its **class names as
documentation of intent**, not as a stylesheet to import.

## Fidelity

**High-fidelity.** Colours, type scale, spacing, radii, shadows, keyboard
shortcuts and copy are all final and specified below. Recreate pixel-accurately
using the codebase's existing primitives. Copy in the mocks is production copy —
use it verbatim; the wording is a deliberate part of the design ("Checks", not
"Review Queue"; "Ageing", not "Stale").

Two things are *not* final: illustration/empty-state art, and real data. All
names, docs and counts in the mocks are sample content.

---

## 1. Design tokens

Verbatim from `aqli-v3.css` `:root`. These mirror `app/globals.css` — reuse the
existing variables rather than introducing new ones.

### Colour

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#FAFAF8` | app background, paper background |
| `--bg-sidebar` | `#F2F1ED` | sidebar, code chips, hovered list items in ⌘K |
| `--bg-card` | `#FFFFFF` | cards, sheets, rails, popovers |
| `--bg-paper` | `#FDFDFB` | reserved for paper variants |
| `--text-primary` | `#1A1A18` | body + titles |
| `--text-secondary` | `#6B6A64` | supporting text |
| `--text-muted` | `#9E9D96` | labels, metadata |
| `--border` | `#E5E4DF` | all hairlines |
| `--border-strong` | `#D7D5CE` | inputs, sheet edges, dashed empties |
| `--accent` | `#0F6E56` | primary action, active nav, links |
| `--accent-hover` | `#0B5A46` | primary hover |
| `--accent-light` | `#E1F5EE` | active nav tint, focus ring, selected rows |

Doc body text is `#242422` — very slightly lighter than `--text-primary`, which
is used for headings. Keep the distinction.

**Status triads:**

| State | bg | text | border | bare dot |
|---|---|---|---|---|
| Current | `#E1F5EE` | `#0F6E56` | `#9FE1CB` | filled `#0F6E56` |
| Ageing | `#FAEEDA` | `#854F0B` | `#FAC775` | filled `#D99B2B` |
| Unverified | `#F2F1ED` | `#6B6A64` | `#E5E4DF` | **ring only**, `inset 0 0 0 1.5px var(--text-muted)` |

Unverified is a hollow dot in both pill and bare form. That is the whole visual
grammar: filled green = confirmed, filled amber = going stale, hollow = never
confirmed.

**Avatar gradients** (135°): `av-a` `#2F7D62→#0F6E56` · `av-s` `#C7754A→#993C1D`
· `av-k` `#4A6FB5→#2C4A82` · `av-y` `#8B7BD8→#6C5CC4`.

**Diff colours** (history screen): removed `bg #FBE3E1 / text #8A2A22 /
line-through`; added `bg var(--current-bg) / text var(--current-text)`.

### Type

Three families, loaded from Google Fonts:

- **Sans** — `'Open Sans'` 400/500/600 → UI chrome, labels, metadata.
- **Serif** — `'Source Serif 4'` (variable optical size 8–60) 400/500/600 → doc
  titles, doc body, page H1s, list item titles, sheet headings.
- **Mono** — `'Geist Mono'` 400/500 → doc-type labels, counts, keycaps, route names.

The serif/sans split is load-bearing: **serif = content, sans = interface.**

| Role | Family | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|---|
| Doc title (`.dt`) | serif | 40px | 400 | 1.1 | −.02em |
| Doc body (`.dbody`) | serif | 18.5px | 400 | 1.78 | — |
| Doc H2 | serif | 23px | 600 | 1.3 | −.008em |
| Doc H3 | sans | 14px | 600 | — | .04em, uppercase |
| Page H1 (`.h1`) | serif | 31px | 400 | — | −.018em |
| Page subhead (`.h1s`) | sans | 14px | 400 | — | — |
| Section label (`.sect-h h2`) | sans | 12px | 700 | — | .13em, uppercase |
| List item title (`.row .t`) | serif | 16.5px | 500 | — | −.006em |
| List meta (`.row .m`) | sans | 12px | 400 | — | — |
| Onboarding question (`.ob-q`) | serif | 34px | 400 | 1.16 | −.02em |
| Sheet heading (`.sheet-h h3`) | serif | 21px | 500 | — | −.01em |
| Status pill (`.tl`) | sans | 11.5px | 600 | — | — |
| Field label (`.fl`) | sans | 11px | 700 | — | .1em, uppercase |
| Nav item | sans | 13.5px | 400 (600 when active) | — | — |
| Doc-type tag (`.ty`) | mono | 10px | 400 | — | .05em, uppercase |

Body base for chrome: 14px / 1.5.

### Spacing, radius, shadow

- Spacing is a loose 4px-ish scale in practice: 3, 6, 7, 8, 10, 12, 14, 16, 18,
  20, 22, 26, 32, 34, 36, 40, 44, 52, 56.
- Radii: 3 (keycap) · 5 · 6 (buttons, nav, icon buttons) · 7 (inputs, `.btn.lg`)
  · 9 · 10 (cards) · 12 (screens, sheets, empties) · 13 (⌘K) · 44 (phone) · 99
  (pills, avatars, dots).
- Shadows:
  - screen frame `0 24px 60px -20px rgba(20,20,18,.26), 0 3px 10px rgba(20,20,18,.05)`
  - sheet `0 30px 70px -20px rgba(20,20,18,.4)`
  - ⌘K `0 34px 80px -22px rgba(20,20,18,.44)`
  - slash menu `0 16px 40px -12px rgba(20,20,18,.26)`
  - AI panel `0 24px 56px -18px rgba(20,20,18,.34)`
  - reading rail `-14px 0 34px -22px rgba(20,20,18,.3)`
  - AI dot `0 8px 20px -8px rgba(20,20,18,.22)`
  - scrim `rgba(20,20,18,.34)`

### Fixed dimensions

| Thing | Size |
|---|---|
| Desktop frame | 1440 × 900 |
| Phone frame | 390 × 844, radius 44 |
| Sidebar | 232px fixed |
| Settings nav | see §5.10 |
| Top bar | 54px |
| Reading rail, open | 312px |
| Reading rail, closed (tab) | 40px |
| Paper column measure | max-width **712px**, padding `56px 40px 200px` |
| Publish / modal sheet | 440px |
| ⌘K palette | 620px, list max-height 392px, offset `margin-top:-80px` |
| Slash menu | 322px |
| AI panel | 392px |
| Onboarding card | 466px |
| Content wrap | `padding: 34px 44px 90px`, `.narrow` max-width 920px |

---

## 2. Component inventory

Each entry names the mock class so you can find it in `aqli-v3.css`.

### Buttons — `.btn`
32px tall, 12px horizontal, radius 6, sans 13/600, 6px gap to icon.
- `.pri` — bg `--accent`, white text; hover `--accent-hover`.
- `.sec` — bg `--bg-card`, 1px `--border`; hover border `--border-strong`.
- `.gho` — text `--text-secondary`; hover bg `rgba(0,0,0,.04)`, text primary.
- `.lg` 40px / 18px pad / 14px / radius 7 · `.sm` 27px / 9px pad / 12px / w500.
- Disabled: `opacity .45`, default cursor.
- `.ib` icon button: 32×32, radius 6, `--text-secondary`; hover bg
  `rgba(0,0,0,.05)`.
- `.kbd` keycap: mono 10px, 1px `--border`, radius 3, `1px 5px`.

### Status pill — `.tl` + bare dot `.dot`
Pill: 21px tall, `0 8px 0 7px`, radius 99, 1px border, 6px inner dot, 6px gap,
label sans 11.5/600. Bare dot: 7px, for dense lists and the phone.
**Both forms must render identically wherever a doc appears** — list, search,
sidebar, space page, phone, history.

### Avatar — `.av`
26px default / `.s` 20px / `.l` 34px, radius 99, white initial, sans 600 at
10.5 / 9 / 12.5px.

### Sidebar — `.sb`
232px, bg `--bg-sidebar`, right 1px `--border`, padding `18px 0 10px`.
- Header: wordmark (SVG from `components/aqli/AqliMark.tsx`) + 16px/.09em
  label; workspace name below at 10.5px/.13em/600 uppercase muted.
- Nav items `.nav-i`: 7px 10px, radius 6, 10px gap, 16px icon slot. Hover
  `rgba(0,0,0,.035)`. Active `.on`: bg `rgba(15,110,86,.08)`, text + icon
  accent, weight 600. Right-aligned `.k` (mono 10.5 keycap) or `.n` (mono 11
  count).
- Group label `.nav-lb`: `20px 18px 6px`, 10px/.14em/700 uppercase muted.
- **There is no "Workflow" group.** Order: Home, Drafts, Checks, Search, then
  `SPACES`, then `+ New space`, then the footer user row.
- Footer `.sb-foot`: top 1px border, avatar + name (13/600) + role (11 muted).

### Space icons
Line icons from `components/aqli/icons.tsx` — Book, Flag, Gear, Users, Table,
Chat, Archive, Folder — replace the old emoji defaults. Emoji remains a
selectable option in the space picker; render it in the same 18×16 slot.

### Top bar — `.tb`
54px, bottom 1px `--border`, `0 20px`, 12px gap. `.bare` variant (no bottom
border) is used on **write and read** — the paper must not sit under a rule.
Breadcrumb `.crumb` 13.5px secondary with muted separators, current doc bold
primary and truncating. `.saved` = 5px accent dot + 12px muted "Saved".

### Paper — `.paper` / `.col`
Centred column, max-width 712px. This is shared verbatim by write and read; the
only difference between them is the trust line and whether the body is
editable. Do not fork the styles.

### Trust line — `.tline`
One line, 16px under the title: status pill + `checked by [avatar] Sara, 5 days
ago`. A `Re-verify`/`Nudge` action sits right-aligned and is **hidden until row
hover** (`visibility`, so it does not reflow). This is the entire maintenance UI
on the reading surface.

### Reading rail — `.tab` (closed) / `.rail` (open)
Ships **closed**: a 40px strip on the right edge with an icon and a
vertical-RL label (10.5px/.16em uppercase muted); hover tints to
`--bg-sidebar`. Open: 312px, bg `--bg-card`, left border, that inset shadow.
Tabs `.rt` 12.5/600 muted, active gets primary text + 2px accent underline.
Three tabs: **Outline · Cited by · History**.
- Outline items `.ol-i`: 13px, radius 5, `.sub` indents 20px at 12.5px; active =
  `--accent-light` bg, accent text, 600.
- Backlink `.bl`: title 13/600, meta 11.5 muted with a status dot; hairline
  between, none on last.

### List row — `.row`
Grid `auto 1fr auto`, 14px gap, `13px 4px`, bottom hairline (none on last),
hover `rgba(0,0,0,.018)`. Leading cell is a status pill/dot, avatar, or mono
count. Title serif 16.5/500; meta 12px muted with 7px gaps.

### Card / grid / empty
`.card` white, 1px `--border`, radius 10, `18px 20px`. `.grid2` / `.grid3` with
14px gap. `.empty` dashed `--border-strong`, radius 12, `52px 40px`, centred;
serif 26/400 heading, 14/1.65 secondary body capped at 400px.

### Sheet — `.scrim` + `.sheet`
440px, radius 12, 1px `--border-strong`. Header `20px 22px 0` with serif 21/500
title and 13px secondary sub. Body `18px 22px 4px`, 16px stack. Footer
`16px 22px`, top border, bg `--bg-base`.
Inputs `.inp`: 38px (`.lg` 46px/16px), radius 7, 1px `--border-strong`; focus =
accent border + `0 0 0 3px var(--accent-light)`.
Chips `.pick`: 32px, radius 99, 1px `--border`, 13px secondary; `.on` =
`--accent-light` bg, `--current-border` border, accent text, 600.

### ⌘K — `.cmdk`
620px, radius 13, input row 56px with 16.5px borderless field, grouped list
(`.cg` 10px/.14em/700 uppercase), items `.ci` grid `auto 1fr auto` with title
13.5/600 and 12px muted sub; hover `--bg-sidebar`, keyboard-selected
`--accent-light`. 38px footer of 11.5px muted hints.

### Slash menu — `.slash`
322px popover anchored to the caret. Items `.si` grid `26px 1fr auto`: 26px
rounded glyph tile (`--bg-sidebar`, accent-tinted when selected), name 13/600,
hint 11.5 muted, keycap right.

### AI affordance — `.spark` → `.aip`
Closed: a single 40px circular dot, bottom-right `24px`, white, 1px
`--border-strong`, muted glyph; hover turns accent. **This is the only AI
element on the writing surface.** Open: 392px panel replacing it at `22px`, with
a 13px header row, suggestion cards `.sug` (1px border, radius 9, bg
`--bg-base`, 12.5px title + 12.5/1.55 body), and a footer input row.

### Onboarding — `.ob`
Full-bleed 1440×900. 62px top bar: wordmark left, step pips right — `.ob-dot`
26×4 radius 99, `--border-strong` default, `--accent` current,
`--current-border` done. Centre column 466px, optically raised
(`padding-bottom: 60px`): mono eyebrow, serif 34px question, 14.5/1.6
secondary, 12px-gap field stack, then actions with **Skip as a real 13px text
button beside the primary**, not a grey link.

### Phone — `.phone`
390×844, radius 44. 46px status bar, 50px top bar, 76px bottom tab bar
(`.ptab` 10.5/600 muted, accent when active). Three tabs only.

---

## 3. The status system (read this before building anything)

One question — *is this still true?* — with three answers:

- **Current** — confirmed recently.
- **Ageing** — nobody has confirmed it in a while.
- **Unverified** — never confirmed, or edited since it last was.

Rules:
1. Draft / Review / Approved / Stale and the `AutoApproved` chip are **removed
   from the data model's display layer**. If the DB keeps lifecycle columns,
   they must not surface in the UI.
2. "Draft" is a *place* (`/drafts`), not a state. Unpublished docs are invisible
   to everyone but their author and anyone explicitly shared with.
3. Publishing with checkers selected → **Unverified**, trust line reads
   `waiting on Sara and Khalid`, action = `Nudge`.
4. Publishing with no checkers → **Current**, attributed to the author.
5. Editing a Current doc → drops to **Unverified** (see open question in
   BRIEF.md §6 — designs assume yes).
6. Agent- and PR-authored docs are attributed in the trust line and in history,
   but get **no special chip and no special status**.

---

## 4. Interactions & behaviour

Implemented for real in `Aqli v3 - Write.html`; mirror this behaviour.

### Keyboard
| Key | Action |
|---|---|
| `/` at caret | open slash menu, filter as you type, `↑↓` move, `↵` run, `Esc` close |
| `⌘K` / `Ctrl K` | command palette, from anywhere |
| `⌘J` / `Ctrl J` | open the AI panel (edit view only) |
| `⌘⏎` | open the Publish sheet |
| `Esc` | close whichever overlay is topmost |

### Slash menu
Opens only when a caret rect exists. Commands: Heading, Bulleted list, Numbered
list, Table, Quote, Divider, Cite a doc. Filter matches on command name.
Position: 8px below the caret, flipped above when it would overflow the stage,
clamped to `stageWidth − 340`. Running a command deletes the typed `/query`
first, then inserts.

### Publish sheet (`⌘⏎`)
Title carries over from the doc. Fields: **space** (single-select chips),
**type** (single-select), **who should check this** (multi-select people
chips). A live hint under the chips reads
`Publishes now. Sara and Khalid will be asked to check it.` and falls back to
`Publishes now. Nobody will be asked to check it — it'll show as Unverified.`
when none are picked. Publishing switches to the read view, transfers title +
body, and sets the trust line per §3.

### Reading rail
Closed by default. Opening builds the outline from the rendered `h2`/`h3` in
document order (`h3` → `.sub`). Clicking an outline entry smooth-scrolls the
paper to `heading.offsetTop − 40` and marks itself active. Cited-by is also
rendered at the foot of the doc so the information exists with the rail closed.

### Hover behaviour
- List rows tint `rgba(0,0,0,.018)`.
- Trust-line action appears on hover of the trust line.
- Nav items tint `rgba(0,0,0,.035)`.
- Doc sections do **not** expose hover toolbars, block handles, or drag grips.
  This is deliberate — it is the main thing that makes the surface feel calm.

### Transitions
Everything is short and unshowy. Overlays fade/appear at ~120–150ms ease-out;
the rail slides 312px in ~180ms ease-out; outline scroll is `behavior:'smooth'`.
No spring, no bounce, no staggered entrances.

### Loading & error states (not drawn — implement to these rules)
- Paper: render the skeleton as a title bar + three text bars at the real
  measure. Never a spinner over the writing surface.
- Save: the `.saved` dot + "Saved" is the only affordance; on failure it becomes
  `Not saved — retrying` in `--ageing-text`.
- ⌘K: keep the last results visible while fetching; no empty flash.
- Search: if the answer fails, show sources alone rather than an error card.
- Publish: button goes disabled with "Publishing…"; failure keeps the sheet open
  with an inline message above the footer.

### Responsive
Desktop is a fixed three-region layout (sidebar / main / rail) down to ~1100px,
below which the rail becomes an overlay and the sidebar collapses to icons.
Under 768px use the phone design: **read and capture only** — no checks, no
settings, no space browsing.

---

## 5. Screens

Frame numbers match `Aqli v3 - Screens.html`.

### 5.1 · 01 Account (onboarding 1/3)
**Purpose:** create the account. **Layout:** `.ob` shell, 466px centre card.
Email + password on **one screen** (the v1 split is gone), plus one-tap SSO
above. Copy: "Email and password, or one tap. Nothing else is asked."
Step pips: 1 of 3.

### 5.2 · 02 Workspace (2/3)
Name pre-filled from the email domain. The workspace URL is **derived and shown,
never asked for**. Primary continues; no skip.

### 5.3 · 03 Spaces (3/3)
Space checklist with **one already ticked** and sufficient. `Skip` is a
first-class 13px text button beside the primary. **No AI-key step** — that was
onboarding's old step 4 and now lives at Settings › AI access.

### 5.4 · 04 First run
The arrival moment. Sidebar + one target: a single primary "Write something"
plus three starter patterns and a waiting cursor. No tour, no checklist, no
empty-state illustrations of features.

### 5.5 · 05 Writing
Bare `.tb` (no border), paper column, editable title + body, `.spark` dot
bottom-right, slash menu at the caret, `Publish` in the top bar. **Nothing
else on screen** — no rail, no status, no owner, no doc type, no breadcrumb
metadata beyond space › doc.

### 5.6 · 06 Reading
Same paper column. Adds the trust line under the title and `Cited by 3 docs` at
the foot (title serif, entries `.bl` with status dots and the cited section
name). The rail is drawn **open in this frame only, to document it** — it ships
closed as the 40px tab.

### 5.7 · 07 Home
Answers one question: what should I read, write, or check today. Sections, in
order:
1. **Waiting on you** — `.row`s led by a status pill, with why-you ("Sara asked
   you to check it · 2 days ago", "You own it · nobody has confirmed it in 4
   months · 3 docs cite it"). Right-aligned `All checks →`.
2. **New since Monday** — dot + title + `TYPE` tag + provenance ("written from
   PR #1247 · merged by Khalid").
3. **Asked this week · no doc answers it** — led by a mono ask-count (`7×`),
   question in italic serif, action to draft an answer.

No notification bell, no review counter, no stats row.

### 5.8 · 08 Space
Shelves, not a filterable table. Header with a **health bar** (proportion
Current/Ageing/Unverified) and one Ageing filter chip. Then **Start here** (3
`.tpl` cards, editable by the owner), **Reading path** ("New here? Read these
four, in order." · "~20 minutes · 38 people have finished it"), **topic
shelves**, and gaps. Tallest frame — 1360px.

### 5.9 · 09 Checks
Was "Review Queue". Reads as a to-do list: each item says who asked, why, and
how long it will take. Agent drafts appear here with agent attribution. No
approve/reject/request-changes modal set — you open the doc and either confirm
it or edit it.

### 5.10 · 10 Settings · AI access
Where onboarding's fourth step went. `.set-nav` sidebar with a back button.
Sections: **Connected** keys (per-key: agent name in serif 16.5/500, scope line,
counts — this absorbs the deleted `/agent-log`) with `＋ New key`; and **Rules**,
whose first card is "A person confirms every agent draft" with a toggle.

### 5.11 · 11 Search
Full page for when the answer needs its sources shown (⌘K handles fast answers).
Answer block, `Matches · 6` with scope chips (Everywhere / this space / …), and
**Nobody has written this down** listing unanswered questions with ask counts.

### 5.12–5.14 · 12–14 Phone: Home, Reading, Writing
390×844. Home = the same three Home sections at phone scale (15px titles, bare
dots, 12px padding rows). Reading = paper at 17px with 20px H2s. Writing =
title + body + keyboard. Three bottom tabs.

### 5.15 · 15 Drafts
Framed around finishing, not review. Subhead states the privacy contract
verbatim: "Nobody can see these but you. They stay drafts until you publish
them." Two groups: **Yours** (led by a doc glyph) and **Started by others,
shared with you** (led by an avatar, meta says what they want from you).

### 5.16 · 16 Doc history
Reached from the rail's History tab. Versions left, the change itself right.
Each version is described in prose — "Ali edited this, then Sara confirmed it
the same day. Three docs cite this section — all three were re-checked
automatically." — above an inline diff in the doc's own serif at 17px.

### 5.17 · 17 Settings · People
Members and pending invites in **one list**, because to a human they are the
same thing. Invite is a row action, not a separate landing screen.

### 5.18 · 18 Settings · Integrations
Was a provider grid. Each row now states **what the connection writes into the
workspace**, not just that it's available.

### 5.19 · 19 Retired
A documentation frame, not a product screen — do not build it. It records the
four deleted routes and where each job went. Use it as your deletion checklist:

| Route to delete | Job now lives in |
|---|---|
| `/stale` | the Ageing state, carried by the doc everywhere + one filter chip on the space page |
| `/agent-log` | Settings › AI access (per-key counts); drafts arrive in Checks |
| `/review` + sidebar "Workflow" group | **Checks**, top-level |
| `/s/[space]/new` | deleted — Write goes straight to a cursor; type and space are asked in the Publish sheet |

---

## 6. State

Client state needed for the writing/reading surface:

```
view          'edit' | 'read'
doc           { id, title, bodyHtml, space, type, status, checkers[], updatedAt }
slash         { open, query, selectedIndex, caretRect }
ai            { open, suggestions[], prompt }
publish       { open, space, type, checkers[] }
rail          { open, tab: 'outline'|'citedBy'|'history', activeHeadingIndex }
cmdk          { open, query, selectedIndex, results[] }
save          'idle' | 'saving' | 'saved' | 'error'
```

Transitions: `/` → slash open · command run → insert + slash close · `⌘J` → ai
open (dot hides) · `⌘⏎` → publish open · publish confirm → status per §3, view
`read` · rail open → build outline from rendered headings.

Data the screens need: home buckets (waiting-on-you, new-since, asked-this-week
gaps), space shelves + health counts + reading paths, checks queue, drafts
(yours / shared), search answer + sources + gaps, version list + diffs, keys
with per-agent counts, members + invites, integrations with write-scopes.

---

## 7. Copy rules

The wording is design. Keep these:

- **Checks**, never "Review Queue", "Approvals", or "Workflow".
- **Current / Ageing / Unverified**, never "Stale", "Approved", "Draft" as a status.
- "Nobody has written this down", never "No results" or "Content gap".
- "Waiting on you", never "Pending review".
- "Nobody can see these but you." Say the privacy contract plainly.
- Metadata explains *why you're seeing it* ("You own it · nobody has confirmed
  it in 4 months · 3 docs cite it"), not just when it changed.
- Sentence case everywhere except the uppercase tracked micro-labels.
- No exclamation marks, no emoji in product chrome.

---

## 8. Accessibility

- Status must not be colour-only: every pill carries its word; bare dots need
  `aria-label` / `title` with the state name.
- Unverified's hollow dot gives a non-colour cue for the most consequential state.
- Focus ring is the input treatment: accent border + `0 0 0 3px var(--accent-light)`.
- `--text-muted` `#9E9D96` on `#FAFAF8` is ~2.6:1 — acceptable for the 10–12px
  tracked labels it is used for, but **never** put body copy in it.
- All hover-revealed actions (trust-line `Re-verify`, row actions) must be
  keyboard-reachable and visible on focus, not just hover.
- The rail's closed tab is a real button with an accessible name.

## 9. Assets

- **Wordmark + icons** — real path data from `components/aqli/AqliMark.tsx` and
  `components/aqli/icons.tsx` in `AAALI/aqli`. Use those components; don't
  re-trace the SVGs out of the mocks.
- **Space icons** — the same repo icon set (Book, Flag, Gear, Users, Table,
  Chat, Archive, Folder).
- **Fonts** — Open Sans, Source Serif 4, Geist Mono. Self-host in production;
  the mocks use the Google Fonts CDN.
- No illustrations, photography, or emoji are used anywhere.

## 10. Files in this bundle

| File | What it is |
|---|---|
| `Aqli v3 - Screens.html` | All 19 frames on a pannable canvas. The spec. |
| `Aqli v3 - Write.html` | **Interactive** prototype: write ↔ read, slash menu, ⌘K, ⌘J, publish sheet, reading rail. Run this first. |
| `aqli-v3.css` | Tokens + every class referenced above. |
| `BRIEF.md` | Why v3 looks like this — principles, decisions, open questions. |
| `JOURNEYS.md` | Sitemap + 10 journeys mapped frame-by-frame. |
| `screenshots/` | Every frame as a PNG, plus five prototype states (see below). |

**`screenshots/`** — all 19 frames at 1440px wide (phones at 2×), then the
interactive states that only exist in the prototype:

`01-onboarding-account` · `02-onboarding-workspace` · `03-onboarding-spaces` ·
`04-first-run` · `05-writing` · `06-reading` · `07-home` · `08-space` ·
`09-checks` · `10-settings-ai-access` · `11-search` · `12-phone-home` ·
`13-phone-reading` · `14-phone-writing` · `15-drafts` · `16-doc-history` ·
`17-settings-people` · `18-settings-integrations` · `19-retired-routes` ·
`20-write-slash-menu` · `21-write-ai-panel` · `22-publish-sheet` ·
`23-command-palette` · `24-reading-rail-open`

Open `Aqli v3 - Write.html` in a browser and use it for two minutes before
reading further — the restraint is easier to feel than to read.

## 11. Repo mapping

Existing app: `AAALI/aqli`, branch `main`, Next.js App Router. Screen → source:

| v3 screen | Rebuild in |
|---|---|
| Write | `components/editor/AqliEditor.tsx`, `EditorToolbar.tsx`, `app/(app)/w/[workspace]/(main)/docs/[id]/edit/` |
| Read | `.../docs/[id]/page.tsx`, `components/docs/ReadingRail.tsx`, `TrustLine.tsx`, `ProvenanceBar.tsx` |
| ⌘K | `components/cmdk/CommandPalette.tsx`, `app/api/search/route.ts` |
| Onboarding 01–03 | `components/auth/Onboarding.tsx`, `lib/onboarding/plan.ts`, `app/(auth)/signup/page.tsx` |
| First run + Home | `app/(app)/w/[workspace]/(main)/page.tsx`, `lib/home.ts`, `components/editor/templates/` |
| Space | `.../(main)/s/[space]/page.tsx`, `components/spaces/ShelvesView.tsx` |
| Checks | `.../(main)/review/` (rename to `checks`), `components/docs/WhatChangedBanner.tsx` |
| Search | `.../(main)/search/page.tsx`, `app/api/search/route.ts` |
| Drafts | `.../(main)/drafts/page.tsx`, `components/docs/DocList.tsx` |
| History | `.../docs/[id]/history/` |
| Settings · AI access | `.../settings/keys/KeysClient.tsx`, `components/integrations/AutoApprovePolicyToggle.tsx` |
| Settings · People | `.../settings/members/`, `app/(auth)/invite/` |
| Settings · Integrations | `.../settings/integrations/`, `settings/integrations/[provider]/` |
| Phone | `components/layout/mobile-nav.ts`, `MobileNavToggle.tsx` |
| Shell + tokens | `components/layout/Sidebar.tsx`, `app/globals.css` |
| **Delete** | `(main)/stale/`, `(main)/agent-log/`, `(main)/s/[space]/new/`, the ProvenanceBar chip variants, `AutoApproved` badge |

## 12. Suggested build order

1. **Tokens + status component.** Reconcile `app/globals.css` with §1 and build
   the one `<Status>` component. Nothing else lands cleanly until statuses are
   unified.
2. **Shell.** Sidebar without the Workflow group; `/review` → `/checks`.
3. **Paper + write.** Bare top bar, 712px column, slash menu, `.spark`/`⌘J`.
   Delete the editor rail and the process strip.
4. **Publish sheet.** All the process that step 3 removed reappears here.
5. **Read + rail.** Trust line, collapsed rail, cited-by, history.
6. **Home, Drafts, Checks, Search.**
7. **Space shelves.**
8. **Settings ×3**, then delete the retired routes.
9. **Phone** three screens.
10. **Onboarding three screens** last — it is the smallest surface and the one
    most likely to shift once the app behind it is real.

## 13. Definition of done

- A new user reaches a blinking cursor in **three screens and under 60 seconds**.
- The writing surface shows **zero** status, owner, or process elements.
- One status component renders every state, on every surface, identically.
- `/stale`, `/agent-log`, `/s/[space]/new` return 404; `/review` redirects to
  `/checks`.
- The reading rail is closed on first load of every doc.
- Nothing in the UI says Draft, Approved, or Stale.

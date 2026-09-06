# Aqli v3 — Design brief

> Companion to JOURNEYS.md. JOURNEYS says what the screens are; this says why
> they look like that. Both were rewritten against the v3 screen set — the
> earlier brief argued for a v2 that has since been superseded and deleted.

---

## 1. The bet

Notion and Confluence lose the same way: the writing surface fills with
everything *around* the writing. Breadcrumbs, status pills, owners, reviewers,
comment counts, outline rails, block handles, share state. By the time the
page is ready to be written in, it is already busy.

Aqli's bet is subtraction. **A blank column and a cursor, and nothing else
until you ask for it.** Everything the organisation needs to know about a doc
— who owns it, whether it's still true, who should check it — is asked once,
at publish, and displayed as one dot thereafter.

If a writer can open Aqli and type a sentence without reading a single label,
we win.

---

## 2. What was wrong with the old design

Counted by job-to-be-done, the 28-screen version spent **43% of its surface on
admin and 27% on review process** — four process screens for every writing
surface. A new user learned our workflow before they learned their own
knowledge base. Onboarding asked four things before the first word, one of
them an API key. The editor had a right rail of metadata that helped nobody
write. Status had four values and a chip, so no two surfaces showed it the
same way.

None of it was badly made. It was disproportionate.

---

## 3. Principles

1. **The writing surface is sacred.** Nothing appears on it that does not help
   put words down. Process is not shown to writers; it is collected at publish.
2. **One question, one dot.** *Is this still true?* Current / Ageing /
   Unverified — the same three states, the same dot, on every surface.
3. **Maintenance is woven, never a destination.** No hygiene dashboard. The
   state travels with the doc; the asking travels through Checks.
4. **AI is one quiet affordance, not a panel.** `⌘J`. A person confirms every
   agent draft.
5. **A space is a library.** Start-here docs, a reading path, topic shelves, a
   health bar — not a filterable table of PRDs and ADRs.
6. **Home answers one question:** what should I read, write, or check today.
7. **Human words.** "Checks", not "Review Queue". "Nobody has written this
   down", not "Content gap". "Ageing", not "Stale".
8. **Admin is findable, not present.** Three settings pages, reached on purpose.

---

## 4. The decisions v3 makes

**Onboarding is three screens.** Email + password merged. Workspace name
pre-filled from the email domain; the URL derived, not asked. One space
pre-ticked; Skip is a real button. AI keys moved to Settings · AI access,
optional forever.

**The editor rail is gone.** Outline, citations and consistency checks are all
hidden by default. A slim collapsed rail exists on the *reading* surface only —
outline, cited-by, history.

**Process moved to the publish sheet.** Space, type, owner, who should check
it. `⌘⏎`. A writer who never publishes never sees any of it.

**One status dot, three states.** Draft/Review/Approved/Stale and the
AutoApproved chip are all retired. "Draft" is a place (Drafts), not a state.

**Four routes deleted** — `/stale`, `/agent-log`, `/review`, `/s/[space]/new`.
Frame 19 documents each deletion and where its job went.

**Space icons replace emoji.** Book, Flag, Gear, Users, Table, Chat, Archive,
Folder as defaults; an emoji can still be chosen.

**Mobile reads and captures.** Three screens. No checks, no settings, no
admin.

---

## 5. What is deliberately not changing

- The visual system — type, colour, spacing, dark mode. Strong; kept.
- Agents as first-class actors. v3 narrows *where* they appear, not whether.
- The doc taxonomy (PRD, ADR, Runbook, Fix Note). Still useful — asked at
  publish, shown on read, never in the way of writing.
- Provenance for agent- and PR-authored docs. Still attributed, still visible
  in history; it just no longer needs its own chip, its own status or its own
  log page.

---

## 6. Open questions

- Does an edit to a Current doc drop it to **Unverified** automatically? The
  designs assume yes — an edit is a change to something that was confirmed.
- Who gets asked when an Ageing doc has no owner? Currently: the space's
  start-here curator.
- Is one filter chip enough on the space page, now that `/stale` is gone?

---

## 7. Next

1. Handover package for Claude Code from the v3 set.
2. Landing page rebuilt to match v3 (separate project).

*Last updated: Aug 30, 2026.*

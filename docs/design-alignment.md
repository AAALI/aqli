# Aqli — Design ↔ Implementation Alignment

> Maps the Claude Design handoff bundle (`Aqli` project — v2 knowledge-first
> redesign + v1 screens + GitHub auto-approve addendum) against what is actually
> built in this repo. Use this as the running checklist of design work still
> outstanding.
>
> **Source of truth for designs:** the handoff bundle's `BRIEF.md` (the argument
> for the v2 rework), `JOURNEYS.md` (the v1 journey/screen checklist), and
> `index.html` (the canvas manifest of every artboard).
>
> **Legend:** ✅ implemented · 🟡 partial / diverges · ⬜ not started
>
> _Audited: 2026-06-13; targeted corrections 2026-07-04 (16/23/26 statuses,
> sidebar v2, merged invites/members). This is a point-in-time audit — the
> **live** tracker is [`IMPLEMENTATION.md`](../IMPLEMENTATION.md), which
> supersedes stale rows here (Home/Space/Viewer v2 have since shipped in
> #18–#21)._

---

## 1. Headline

The **v1 product is essentially fully built**, and one of the four big v2 moves —
the **Editor v2** — has already shipped as the real editor. The remaining v2
surfaces (the heart of the "knowledge-first" redesign in `BRIEF.md`) are the
main gap:

- **Home v2** (Today in Aqli) — not started; Home is still the v1 doc list.
- **Space v2** (shelves / reading paths / gaps) — not started; spaces are still
  the v1 flat list with type filters.
- **Doc Viewer v2** (outline, cited-by, trust line, annotations, what-changed) —
  partial; only the "Ask Aqli" rail and summary exist.
- **Sidebar v2** (demote Review Queue, add Drafts/Library) — diverges; Review
  Queue is still a top-level peer of Home.

On the **GitHub auto-approve** addendum: the *backend policy* is fully built
(merged PRs auto-create/approve docs; agent docs auto-approve), but the
*provenance display* (ProvenanceBar, AutoApproved chip, the 25b stats/toggle
settings, the 08c PR-sourced viewer variant) is not yet surfaced in the UI.

The **⌘K command palette** (screens 29/30) is referenced as a hint but not built.

---

## 2. v2 — Knowledge-first redesign (`BRIEF.md`)

This is the redesign the bundle is centered on. The brief's thesis: the product
is "a workflow tool with docs attached" and should flip to knowledge-first.

| # | v2 surface | Status | Where / why |
|---|---|---|---|
| 01b | **Home v2 — "Today in Aqli"** | ⬜ | [app/(app)/w/[workspace]/(main)/page.tsx](<app/(app)/w/[workspace]/(main)/page.tsx>) is the v1 home (recent-docs list + empty state). None of the brief's sections exist: *Pick up where you left off*, *Needs your attention* (the stack that should absorb the Review Queue), *What's new in your spaces*, *Asked this week* (gaps), *Suggested reading*. |
| 03b/03c | **Editor v2 — the writing instrument** | ✅ | Shipped as the real editor: [DocEditorClient.tsx](<app/(app)/w/[workspace]/(main)/docs/[id]/edit/DocEditorClient.tsx>) wires [SlashMenu](components/editor/v2/SlashMenu.tsx), [SelectionToolbar](components/editor/v2/SelectionToolbar.tsx) (highlight-to-act: rewrite/cite/expand), [EditorRail](components/editor/v2/EditorRail.tsx) (live Outline + Related approved passages), floating [CowriteChat](components/editor/v2/CowriteChat.tsx) (⌘J), and [ProcessStrip](components/editor/v2/ProcessStrip.tsx) (dim status/owner footer). **Minor divergence:** brief put Outline+Related on the *left* and Co-write on the *right*; impl puts the structural rail on the right and Co-write as a floating panel. Functionally equivalent. |
| 08b/08b₂ | **Doc Viewer v2 — the knowledge node** | 🟡 | [docs/[id]/page.tsx](<app/(app)/w/[workspace]/(main)/docs/[id]/page.tsx>) has the **Ask-Aqli rail** ([AskQuestion](components/ai/AskQuestion.tsx)) and [DocSummary](components/ai/DocSummary.tsx) ✅. Missing from the brief: left-rail **Outline (TOC)**, **"Cited by N docs" backlinks**, the **trust line** ("Last verified 14d ago · Re-verify"), the **"What changed in v4" banner**, and the **annotation gutter** (threaded Q&A per section). |
| 02b | **Space v2 — shelves, not folders** | ⬜ | [s/[space]/page.tsx](<app/(app)/w/[workspace]/(main)/s/[space]/page.tsx>) is the v1 flat list with the exact "bureaucratic" type filters the brief critiques (All / PRD / ADR / Runbook / Fix Note). None of the v2 views exist: *Start here* (3 canonical docs), *Reading paths*, *By topic* shelves, *Gaps* (unanswered questions → "Draft this"). |
| — | **Sidebar v2 — demote Review Queue** | ✅ | Shipped in #21: Home · Drafts · Search up top; Review Queue, Stale docs, and Agent log demoted under a "Workflow" section. **Library** remains deferred (needs bookmarks/read-history data). |
| — | **Maintenance woven in** | 🟡 | Stale dashboard exists ([stale/](<app/(app)/w/[workspace]/(main)/stale>)) ✅, but the brief's *woven* maintenance is absent: no trust line / re-verify CTA on the viewer, no inline stale badges in doc lists, no Home auto-pings when an upstream-cited doc or Linear ticket changes (blocked on Home v2). |

---

## 3. GitHub auto-approve policy (`BRIEF.md` addendum)

**Decision (Jun 10):** merged PRs on watched branches auto-publish docs as
**Approved**, attributed to the merger; all other agents still require review.

| Item | Status | Where / why |
|---|---|---|
| Auto-approve backend (PR → doc) | ✅ | [lib/integrations/source/feature-doc.ts](lib/integrations/source/feature-doc.ts) creates/patches a Fix Note from a merged PR and approves it directly; stores `source_pr_url` / `source_repo` in frontmatter. Webhook at [composio/webhook](app/api/integrations/composio/webhook/route.ts). |
| Agent-authored docs auto-approve | ✅ | [app/api/agent/docs/route.ts](app/api/agent/docs/route.ts) creates agent docs as `approved` and logs `auto_approved` activity. |
| **ProvenanceBar** (human / agent / pr modes) | ⬜ | No provenance bar under the doc title in the viewer. Provenance only appears in the marketing [FlowDemo](components/landing/FlowDemo.tsx). |
| **AutoApproved chip** (distinct from Approved) | ⬜ | [badges.tsx](components/aqli/badges.tsx) has Draft/Review/Approved/Stale/Archived + a generic `AgentChip`, but no `AutoApproved` chip. |
| **AuthorBadge** (per-agent tint + icon) | 🟡 | `AgentChip` exists but is a single generic chip — no per-agent tint/identity. |
| **25b** GitHub settings (policy hero + 3 stats + off-toggle + per-repo table) | 🟡 | [settings/integrations/[provider]/page.tsx](<app/(app)/w/[workspace]/settings/integrations/[provider]/page.tsx>) describes matched/unmatched-PR behavior read-only and has a repo picker. Missing: the hero stats (auto-approved this quarter, reviews self-reported, median PR→doc latency) and the **single toggle to disable** auto-approve (route PRs to review instead). |
| **08c** Doc Viewer "auto-created from PR" variant | ⬜ | No green PR provenance bar, PR-reviewer trust line, or "What this PR changed" banner. |
| Home headline ("4 PR merges auto-published…") | ⬜ | Blocked on Home v2. |

---

## 4. v1 journeys (`JOURNEYS.md`)

The v1 design set is mostly complete. Status reflects routes/components that
exist in the repo.

| Journey | Status | Notes |
|---|---|---|
| J·01 First-time setup (OB1–OB5 + empty home) | ✅ | [Onboarding.tsx](components/auth/Onboarding.tsx), [signup](<app/(auth)/signup/page.tsx>), empty-home state in main page. |
| J·02 Returning user (sign in → home) | ✅ | [login](<app/(auth)/login/page.tsx>). |
| J·03 Invited teammate (accept invite → set password) | ✅ | [invite/](<app/(auth)/invite>) + [api/invitations](app/api/invitations/route.ts). Merged. Email-invite HTML template still not built — invites are link-based. |
| J·04 Browse & read a doc | ✅ | Space list → viewer → editor all present. |
| J·05 Create a new doc (type/template picker) | ✅ | [s/[space]/new](<app/(app)/w/[workspace]/(main)/s/[space]/new>) + [templates](components/editor/templates/index.ts). |
| J·06 Doc lifecycle (Draft→Review→Approved→Stale) | 🟡 | [DocStatusControl](components/docs/DocStatusControl.tsx), [RequestReviewButton](components/docs/RequestReviewButton.tsx), version snapshots on create/status-change all exist. No dedicated snapshot-confirm UI (as in v1 design). |
| J·07 Review agent output | 🟡 | Queue with **inline** approve / reject / request-changes ([ReviewQueueClient.tsx](<app/(app)/w/[workspace]/(main)/review/ReviewQueueClient.tsx>)) ✅. **Gaps:** no dedicated **Review Detail** screen (12 — side-by-side diff + comments + agent context), and no **Notifications panel** (11). |
| J·08 Search & ask | 🟡 | Search + AI answer with citations ✅ ([SearchClient.tsx](<app/(app)/w/[workspace]/(main)/search/SearchClient.tsx>)). **Multi-doc Q&A chat** is explicitly deferred to the agent API (P1) — not built. |
| J·09 Add another AI agent (API keys) | ✅ | [settings/keys](<app/(app)/w/[workspace]/settings/keys>) — list, create, reveal-once. Revoke uses an inline action. |
| J·10 Invite a teammate (members) | ✅ | [settings/members](<app/(app)/w/[workspace]/settings/members>) — list, invite, role select, pending/active. Merged. |
| J·11 Add another Space | ✅ | [NewSpaceButton](components/layout/NewSpaceButton.tsx) + create-space dialog + empty state. |
| J·12 Connect integrations | 🟡 | Integrations list ([settings/integrations](<app/(app)/w/[workspace]/settings/integrations>)) + **Linear** and **GitHub** configure detail ✅. **Slack configure (24)** detail page not built — provider route only accepts `github`/`linear`. |
| J·13 Version history & audit | ✅ | [docs/[id]/history](<app/(app)/w/[workspace]/(main)/docs/[id]/history>) — timeline + diff + restore. |
| J·14 Stale doc hygiene | ✅ | [stale/](<app/(app)/w/[workspace]/(main)/stale>) — dashboard, bulk actions, agent-refresh hint. |
| J·15 Notifications | 🟡 | Top-bar **bell + dropdown feed** ✅ ([NotificationsButton](components/layout/NotificationsButton.tsx), real data via `/api/notifications`, #23). **Gap:** notification **settings page (26)** was never built — the earlier ✅ here pointed at a `redirect()` stub, removed 2026-07-04. |

---

## 5. Other artboards in the canvas

| Artboard(s) | Status | Notes |
|---|---|---|
| LP1 · Landing page (interactive Loop demo) | ✅ | [LandingPage](components/landing/LandingPage.tsx) + [FlowDemo](components/landing/FlowDemo.tsx). |
| A1 · Account menu (logout discoverable) | ✅ | [AccountMenu](components/layout/AccountMenu.tsx) + [SignOutButton](components/layout/SignOutButton.tsx). |
| A2 · Signed-out confirmation | ✅ | Sign-out flow present. |
| 29 / 30 · **⌘K command palette** (idle + query) | ⬜ | Only a `⌘K` hint label in the sidebar — no palette is mounted. Docs/agents/actions/Ask-Aqli-in-one-place is unbuilt. |
| Reference (tokens, components) | n/a | Design-system reference artboards; tokens live in `app/globals.css`. |

---

## 6. Outstanding design checklist

The actionable backlog, roughly in the brief's priority order (knowledge-first
first). Each is a candidate for its own PR.

### v2 redesign (the core of the handoff)
- [ ] **Home v2 — "Today in Aqli"**: needs-attention stack (absorbs Review Queue), what's-new feed, asked-this-week gaps, suggested reading, pick-up-where-you-left-off.
- [ ] **Space v2 — shelves**: Start here, Reading paths, By-topic shelves, Gaps (+ keep flat list as a `List` tab).
- [ ] **Doc Viewer v2**: left-rail Outline (TOC), "Cited by N" backlinks, trust line + Re-verify CTA, "What changed in vN" banner, annotation gutter.
- [ ] **Sidebar v2**: remove top-level Review Queue; add Drafts + Library.

### GitHub auto-approve display (backend already done)
- [ ] **ProvenanceBar** under doc titles (human / agent / pr modes).
- [ ] **AutoApproved chip** distinct from the Approved status badge.
- [ ] **AuthorBadge** with per-agent tint + icon (extend `AgentChip`).
- [ ] **25b GitHub settings**: policy hero + 3 stats + single off-toggle (route to review) + per-repo mapping table.
- [ ] **08c viewer variant**: PR provenance bar + "What this PR changed" banner.

### v1 gaps
- [ ] **Notifications panel (11)** + top-bar bell-with-dot.
- [ ] **Review Detail screen (12)**: side-by-side diff + comments + agent context (today's review is inline-only).
- [ ] **Slack configure (24)** detail page (mirror the Linear/GitHub provider pattern).
- [ ] **⌘K command palette (29/30)**.

### Explicitly future / P1 (per the design's own notes)
- [ ] Multi-doc Q&A synthesis chat (waits on agent API).
- [ ] Email-invite HTML template.
- [ ] Mobile read-only viewer.
- [ ] Public (read-only URL) space.
- [ ] SOC2 audit export (CSV/JSON).

---

_Keep this file in sync as v2 surfaces land — flip boxes and update the status
tables rather than letting it drift._

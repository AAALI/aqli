# Aqli — v2 remaining work (prioritised)

> Companion to `docs/design-alignment.md`. Tracks everything still outstanding
> against the design, ordered highest-value → lowest. Grouped by what's
> buildable now vs. blocked on an in-flight PR.
>
> **Legend:** ✅ done · 🟡 in progress · ⬜ to-do · ⛔ blocked (needs a merge / new data)

_Created 2026-06-15. The four v2 core surfaces (#18–#21) and ⌘K (#22) are merged._

---

## A. Mock data still wired into shipped UI (build from real data)

- ✅ **Notifications bell → real data** — the top-bar bell now reads from `getNotifications()` (review queue + stale + agent activity) via `/api/notifications`; the `lib/mock/agents` placeholder is removed. _(this PR)_
- ⛔ **Search "Aqli Answer" → real `/api/ai/ask`** — the panel is a placeholder that reads "…answers arrive with the agent API" rather than calling the existing ask endpoint. _(overlaps `SearchClient`; do now that #22 is merged)_

## B. Broken / inconsistent (fix)

- ⬜ **Dead settings nav items** — the Settings sidebar links to Members, Agent activity, and Notifications, but those pages `redirect()` to the overview. Remove the dead links (or build the pages).
- ⬜ **Hardcoded demo data** — invite landing prefills `Khalid Rashid / khalid@acme.com`; login ornament hardcodes "3 docs awaiting your review". Make real or remove.
- 🟡 **Dead mock code** — `lib/mock/agents.ts` is deleted in this PR; `lib/mock/settings.ts` (`SAMPLE_KEYS`, `AGENT_ACTIVITY`, `INTEGRATIONS`, `STALE_DOCS`) is still unused — delete as a follow-up.
- ⬜ **Avatar colours** — only `avatar-ali/sara/khalid` gradients exist; everyone else falls back to green/none. Add a name→colour hash.
- ⛔ **Unify search entry points** — sidebar "Search ⌘K" navigates to `/search`; the top-bar icon opens the palette. Make the sidebar row open the palette. _(needs #21 sidebar-v2 + #22 cmdk)_
- ⛔ **Display-name resolution** — Home feed shows real `actor_name`, but the viewer's provenance/trust line show "Team member" / "Unknown" / no reviewer. Pick one source of truth. _(touches Doc Viewer v2 #18)_
- ⛔ **Two `SpaceHeader`s** — v1 `components/aqli/SpaceHeader` + type filters become dead once Space v2 (#20) lands. Remove. _(after #20)_

## C. Designed but unbuilt

- ⬜ **GitHub 25b settings** — policy hero + 3 stats (auto-approved/quarter, reviews self-reported, median PR→doc latency) + off-toggle + per-repo table. Backend exists.
- ⬜ **08c PR-sourced viewer variant** — shield trust line + "What this PR changed" diff banner. _(builds on Doc Viewer v2 #18)_
- ⬜ **Review Detail (12)** — side-by-side diff + comments (review is inline-only today).
- ⬜ **Slack configure (24)** — provider route only accepts `github`/`linear`.
- ⬜ **Viewer annotation gutter** — needs a comments data model.
- ⬜ **Per-agent `AuthorBadge` tint** — we have one generic `AgentChip`.

## D. Deferred — need data/infra that doesn't exist yet

- ⬜ Multi-doc Q&A synthesis · "Asked this week" · "Suggested reading" · Library (bookmarks/stars/read-history) · reading paths & gaps · email-invite template · mobile read-only viewer · public read-only space · SOC2 audit export.

---

_Audit correction: `docs/design-alignment.md` marked Members (16), Agent activity
(23) and Notifications (26) as done — they're hidden redirects (mock-only) on
`main`. To be fixed in that doc._

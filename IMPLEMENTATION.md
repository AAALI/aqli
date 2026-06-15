# Aqli — Design Implementation Tracker

> Single source of truth for the build-out of the Claude Design handoff
> (v2 knowledge-first redesign + the GitHub auto-approve addendum). Update this
> as PRs open, merge, and as items move.
>
> **Companion docs:** [`docs/design-alignment.md`](docs/design-alignment.md) (the
> original design↔code audit) and [`docs/v2-remaining-checklist.md`](docs/v2-remaining-checklist.md)
> (prioritised backlog). This file is the master index over both.
>
> **Legend:** ✅ done/merged · 🟢 in review (PR open) · 🟡 in progress · ⬜ todo · ⛔ blocked · 🔮 deferred (needs data/infra)

_Last updated: 2026-06-15._

---

## 1. Shipped

| PR | Surface | What it delivers | Status |
|---|---|---|---|
| [#17](https://github.com/AAALI/aqli/pull/17) | Design audit | `docs/design-alignment.md` — full design↔code gap analysis | ✅ merged |
| [#18](https://github.com/AAALI/aqli/pull/18) | **Doc Viewer v2** | Outline + cited-by rail, provenance bar, trust line + re-verify, what-changed banner, floating Ask-Aqli, compact Markdown button, `AutoApprovedChip` | ✅ merged |
| [#19](https://github.com/AAALI/aqli/pull/19) | **Home v2** | "Today in Aqli" — hero headline, pick-up cards, needs-attention stack, what's-new feed (`getWorkspaceActivity`) | ✅ merged |
| [#20](https://github.com/AAALI/aqli/pull/20) | **Space v2** | Shelves view (Start here + topic shelves), Shelves/All-docs tabs | ✅ merged |
| [#21](https://github.com/AAALI/aqli/pull/21) | **Sidebar v2** | Knowledge-first nav (Home/Drafts/Search), Drafts page, Review Queue demoted to "Workflow" | ✅ merged |
| [#22](https://github.com/AAALI/aqli/pull/22) | **⌘K palette** | Global command palette, top-bar trigger, `?q=` search handoff, Tab focus-trap fix | 🟢 open (rebased) |
| [#23](https://github.com/AAALI/aqli/pull/23) | **Notifications (de-mock)** | Real bell feed (`getNotifications`), `/api/notifications`, re-adds the now-real bell to the top bar, removed `lib/mock/agents` | 🟢 open (rebased) |
| [#24](https://github.com/AAALI/aqli/pull/24) | This tracker | `IMPLEMENTATION.md` | 🟢 open (rebased) |

> **Merge note:** #22 and #23 both add a button to `AppTopBar`'s action row, so
> whichever merges second has a trivial one-line conflict there — resolve by
> keeping both `<CmdKButton />` and `<NotificationsButton />`.

---

## 2. Remaining — mock still wired into shipped UI

| Item | Notes | Status |
|---|---|---|
| Notification bell → real data | review + agent activity + stale | ✅ [#23](https://github.com/AAALI/aqli/pull/23) |
| Search "Aqli Answer" → real `/api/ai/ask` | panel is a "arrives with the agent API" stub; endpoint already exists | ⛔ overlaps `SearchClient` in #22 |
| Hidden settings stubs (Members 16 / Agent activity 23 / Notifications 26) | currently `redirect()` to overview (mock-only) | ⛔ Members has a real impl on the `feat/invites-members-and-beta-cleanup` branch |

---

## 3. Remaining — broken / inconsistent to fix

| Item | Notes | Status |
|---|---|---|
| Dead settings nav items | sidebar links Members/Agent activity/Notifications → all redirect | ⬜ (decide vs invites branch) |
| Hardcoded demo data | invite prefill `Khalid Rashid`; login "3 docs awaiting review" | ⬜ overlaps invites branch |
| Dead `lib/mock` code | `agents.ts` removed in #23; `settings.ts` (`SAMPLE_KEYS`/`AGENT_ACTIVITY`/`INTEGRATIONS`/`STALE_DOCS`) still unused | 🟡 |
| Avatar name→colour hash | only `avatar-ali/sara/khalid` gradients exist | ⬜ |
| Unify search entry points | sidebar "Search ⌘K" navigates; top-bar icon opens palette | ⛔ needs #21 + #22 |
| Viewer display-name resolution | viewer shows "Team member"/"Unknown"; Home feed shows real names | ⛔ touches #18 |
| Drop v1 `SpaceHeader` + type filters | dead once Space v2 lands | ⛔ after #20 |
| Audit correction | `design-alignment.md` marks 16/23/26 ✅; they're hidden redirects | ⬜ |

---

## 4. Remaining — designed but unbuilt

| Screen | Item | Status |
|---|---|---|
| 25b | **GitHub settings** — policy hero + 3 stats + off-toggle + per-repo table (backend exists) | ⬜ **independent** |
| 08c | Doc Viewer "auto-created from PR" variant — shield trust line + "What this PR changed" banner | ⬜ builds on #18 |
| 12 | Review Detail — side-by-side diff + comments (review is inline-only today) | ⬜ |
| 24 | Slack configure — provider route only accepts `github`/`linear` | ⬜ |
| — | Viewer annotation gutter | ⬜ needs comments model |
| — | Per-agent `AuthorBadge` tint | ⬜ |

---

## 5. Deferred — need data/infra that doesn't exist yet

🔮 Multi-doc Q&A synthesis · "Asked this week" · "Suggested reading" · Library
(bookmarks/stars/read-history) · reading paths & gaps · email-invite template ·
mobile read-only viewer · public read-only space · SOC2 audit export.

---

## 6. Suggested order from here

1. **Merge the open stack (#17–#23)** to unblock the rest.
2. After merge: search "Aqli Answer" → real ask · unify search entry points ·
   viewer display-name · drop v1 SpaceHeader · dead-nav + hardcoded-data cleanup.
3. **GitHub 25b settings** (can be done now — independent).
4. 08c viewer variant · Review Detail · Slack configure.
5. Deferred items as their data/infra lands.

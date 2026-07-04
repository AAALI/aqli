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

_Last updated: 2026-07-04._

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
| [#24](https://github.com/AAALI/aqli/pull/24) | This tracker | `IMPLEMENTATION.md` | ✅ merged |
| [#25](https://github.com/AAALI/aqli/pull/25) | **Author names** | Real author attribution on doc view/cards (`getOwnerDirectory`), nav avatar, collect full name at signup (`member_full_name` migration) | ✅ merged |
| [#26](https://github.com/AAALI/aqli/pull/26) | **Launch cleanup** | Search "Aqli Answer" wired to real `/api/ai/ask`, settings persistence (`SettingsGeneralClient` + `/api/workspaces/[id]`), dead settings nav removed, hardcoded login copy fixed, `avatarColor` hash, mark-all-read | ✅ merged |
| [#27](https://github.com/AAALI/aqli/pull/27) | **Middleware** | Session-refresh middleware restored + `/w/*` route protection | ✅ merged |
| [#28](https://github.com/AAALI/aqli/pull/28) | **App-wide Ask Aqli** | Global chat widget mounted in the workspace layout (every page, incl. settings); replaces per-doc `DocAskChat`; auto-scopes to the doc being read with a dismissible chip; internal citation links use `/w/{slug}/docs/{id}`. Adds a workspace-membership guard to all five `/api/ai/*` routes (they hit the service-role `queryContext` with a caller-supplied `workspace_id`). | 🟢 open |

---

## 2. Remaining — mock still wired into shipped UI

| Item | Notes | Status |
|---|---|---|
| Notification bell → real data | review + agent activity + stale | ✅ [#23](https://github.com/AAALI/aqli/pull/23) |
| Search "Aqli Answer" → real `/api/ai/ask` | fires alongside full-text search, best-effort | ✅ [#26](https://github.com/AAALI/aqli/pull/26) |
| Hidden settings stubs | Members is real; Agent activity redirects to `/agent-log`; the unlinked Notifications redirect stub is deleted | ✅ [#28](https://github.com/AAALI/aqli/pull/28) |

---

## 3. Remaining — broken / inconsistent to fix

| Item | Notes | Status |
|---|---|---|
| Dead settings nav items | sidebar now links only real pages (Workspace/API keys/Members/Integrations/Agent log) | ✅ [#26](https://github.com/AAALI/aqli/pull/26) |
| Hardcoded demo data | invite prefill + login ornament both fixed | ✅ [#26](https://github.com/AAALI/aqli/pull/26) |
| Dead `lib/mock` code | directory removed entirely | ✅ |
| Avatar name→colour hash | `avatarColor` utility in `lib/utils.ts` | ✅ [#26](https://github.com/AAALI/aqli/pull/26) |
| Viewer display-name resolution | real names via `getOwnerDirectory` | ✅ [#25](https://github.com/AAALI/aqli/pull/25) |
| Agent citation URLs broken | `queryContext` now resolves the workspace slug and builds `/w/{slug}/docs/{id}` links | ✅ [#28](https://github.com/AAALI/aqli/pull/28) |
| Unify search entry points | sidebar "Search ⌘K" row now opens the palette (same `aqli:open-cmdk` event as the top-bar icon) | ✅ [#28](https://github.com/AAALI/aqli/pull/28) |
| Drop v1 `SpaceHeader` + type filters | deleted | ✅ [#28](https://github.com/AAALI/aqli/pull/28) |
| Audit correction | `design-alignment.md` corrected (16/23/26, sidebar v2, merged invites) + header note pointing at this tracker as live source | ✅ [#28](https://github.com/AAALI/aqli/pull/28) |

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

## 6. Launch blockers — ops (not code)

| Item | Notes | Status |
|---|---|---|
| **Supabase email confirmation** | ON in prod with no SMTP configured — new signups and invite acceptances stall waiting for emails that never arrive. Configure SMTP or disable confirmation for beta. | ⬜ |
| **Prod secrets in wrangler** | `OPENAI_API_KEY` + Composio keys must be in `wrangler secret list` (not `.env`) or AI chat and GitHub connect fail silently on Cloudflare. | ⬜ verify |

---

## 7. Suggested order from here

1. **Ops blockers (§6)** — SMTP/confirmation decision + `wrangler secret list` check.
2. **GitHub 25b settings** (independent — teams connecting GitHub will look for it).
3. 08c viewer variant · Review Detail · Slack configure.
4. Deferred items as their data/infra lands.

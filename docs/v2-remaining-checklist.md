# Aqli — v2 remaining work (prioritised)

> Companion to `docs/design-alignment.md`. Tracks everything still outstanding
> against the design, ordered highest-value → lowest. Grouped by what's
> buildable now vs. blocked on an in-flight PR.
>
> **Legend:** ✅ done · 🟡 in progress · ⬜ to-do · ⛔ blocked (needs a merge / new data)

_Created 2026-06-15, updated 2026-07-04. All of #18–#27 are merged; #28
(app-wide Ask Aqli + AI route membership guard) is open._

---

## A. Mock data still wired into shipped UI (build from real data)

- ✅ **Notifications bell → real data** — the top-bar bell now reads from `getNotifications()` (review queue + stale + agent activity) via `/api/notifications`; the `lib/mock/agents` placeholder is removed. _(#23)_
- ✅ **Search "Aqli Answer" → real `/api/ai/ask`** — fires alongside full-text search, best-effort. _(#26)_

## B. Broken / inconsistent (fix)

- ✅ **Dead settings nav items** — sidebar now links only real pages _(#26)_; the unlinked `settings/notifications` redirect stub deleted _(#28)_.
- ✅ **Hardcoded demo data** — invite prefill and the login "3 docs awaiting your review" ornament are gone. _(#26)_
- ✅ **Dead mock code** — `lib/mock/` removed entirely.
- ✅ **Avatar colours** — deterministic `avatarColor` hash in `lib/utils.ts`. _(#26)_
- ✅ **Display-name resolution** — real names via `getOwnerDirectory`. _(#25)_
- ✅ **Agent citation URLs** — `queryContext` resolves the workspace slug and builds `/w/{slug}/docs/{id}` links, so `/api/agent/context` consumers get working URLs. _(#28)_
- ✅ **Unify search entry points** — the sidebar "Search ⌘K" row opens the palette via the same `aqli:open-cmdk` event as the top-bar icon. _(#28)_
- ✅ **Drop v1 `SpaceHeader`** — deleted. _(#28)_

## B2. Launch blockers — ops (not code)

- ⬜ **Supabase email confirmation** — ON in prod with no SMTP: signups and invite acceptances stall. Configure SMTP or disable confirmation for beta.
- ⬜ **Prod secrets** — verify `OPENAI_API_KEY` + Composio keys are in `wrangler secret list`; without them AI chat and GitHub connect fail silently on Cloudflare.

## C. Designed but unbuilt

- 🟢 **GitHub 25b settings** — policy hero with a real auto-approve off-toggle (webhook path honors it: PR docs route to Review Queue when off), 3 stats, per-repo table. _(#29)_
- 🟢 **08c PR-sourced viewer variant** — shield trust line + "What this PR changed" banner; Auto-approved chip gated on actual status. _(#29)_
- 🟢 **Per-agent `AuthorBadge` tint** — `AgentChip` icon well tinted by agent id. _(#29)_
- ⛔ **Review Detail (12)** — deferred: needs a comments data model; inline review covers beta. Build together with the annotation gutter post-launch.
- ⛔ **Viewer annotation gutter** — deferred: same comments-model dependency.
- ⛔ **Slack configure (24)** — deferred: no Slack toolkit in the Composio layer; not in the launch story.

## D. Deferred — need data/infra that doesn't exist yet

- ⬜ Multi-doc Q&A synthesis · "Asked this week" · "Suggested reading" · Library (bookmarks/stars/read-history) · reading paths & gaps · email-invite template · mobile read-only viewer · public read-only space · SOC2 audit export.

---

_Audit correction: `docs/design-alignment.md` marked Members (16), Agent activity
(23) and Notifications (26) as done — they're hidden redirects (mock-only) on
`main`. To be fixed in that doc._

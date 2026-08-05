@AGENTS.md

# Aqli — Project Guide for Claude

> The open source shared context layer for human-agent teams. Humans write docs,
> agents read context and write output, humans review and approve.

This file orients any Claude/agent session working in this repo. See `README.md`
for the product overview and self-hosting instructions.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | App Router only. Route `params` are `Promise`s — always `await` them. |
| Language | TypeScript (strict) | No `any`. |
| Styling | Tailwind CSS v4 | Config is CSS-first in `app/globals.css` (`@import "tailwindcss"`, `@plugin "..."`). No `tailwind.config.ts`. |
| DB / Auth | Supabase (Postgres + pgvector + Auth) | Bring your own project; migrations in `supabase/migrations/`. |
| Editor | **Tiptap v3** | `Placeholder` imports from `@tiptap/extensions`. |
| Package manager | pnpm | Not npm/yarn. |

## Commands

```bash
pnpm dev        # local dev (Turbopack)
pnpm build      # production build
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
```

## Commands (continued)

```bash
pnpm test       # vitest
pnpm test:sql   # boots a throwaway Postgres, replays every migration, runs supabase/tests/
```

## Architecture decisions worth knowing

- **Auth model:** Supabase Auth (email/password) via `@supabase/ssr`. `middleware.ts`
  refreshes the session and gates `/w/*` routes. There is **no NextAuth** — Supabase
  handles auth directly.
- **RLS-first data access:** `lib/supabase/*` use the **request-scoped, RLS-respecting**
  server client (`createServerSupabaseClient`), not the service-role key. RLS policies
  enforce workspace membership at the DB layer. API routes additionally gate on
  `auth.getUser()`.
- **Service-role access goes through `lib/db`** (spec §2.4). `scoped(workspaceId)` returns a
  `ScopedClient` that appends the workspace predicate to every select/update/delete and stamps
  `workspace_id` onto every insert, so a query cannot leave its workspace even if the caller
  forgets. An ESLint `no-restricted-imports` rule bans building a raw service client outside
  `lib/db/`. `unscoped(reason)` is the escape hatch for queries that genuinely cannot be scoped
  (resolving a bearer key or a webhook to its workspace) and requires a written reason.
  Tables are opted into `SCOPE_COLUMN` by name — a new table throws rather than defaulting to
  unscoped access.
- **Workspace bootstrap:** signup can't insert a workspace under RLS (no membership yet),
  so a `SECURITY DEFINER` Postgres function `create_workspace_for_user(name, slug)`
  creates the workspace + admin membership + default spaces atomically.
- **Every write is a proposal** (spec §3). `app.submit_proposal` creates one and, when the
  space's `review_policy` and the actor's scopes allow, merges it in the same transaction —
  appending a `revisions` row, advancing the document, superseding rivals. Queued proposals
  wait in the review queue. `app.merge_proposal` raises `stale_base` (surfaced as 409) when the
  document moved under a proposal. The rules live in `lib/merge/disposition.ts` and,
  authoritatively, in `app.decide_disposition`; both have the truth table asserted in tests, so
  change them together.
- **Markdown:** `body_md` is canonical (step 6). `body_json` is a derived Tiptap cache written
  on save so the editor opens without a parse — anything present only there is lost.
  `body_text`, `headings` and `search_vector` are derived from `body_md` by the
  `docs_maintain_derived` trigger, so they stay correct whichever path wrote the row.
- **History:** `revisions` — one row per merged change. `doc_versions` is superseded and read by
  nothing; it is retained so the step-3 backfill stays auditable.
- **Autosave:** 2s debounce in `DocEditorClient`; title saves on blur. A save into a
  `review_all` space returns 202 and is *not* applied — the editor says "Sent for review".

## Data model (Supabase)

`workspaces` → `spaces` → `docs` (+ `revisions`, `proposals`), `members` (workspace↔user role).
`api_keys` carry an accountable `owner_user_id` and `scopes`. Schema lives in
`supabase/migrations/`; helper functions live in the `app` schema, with thin `public` shims
because PostgREST cannot reach `app`. Types mirror the DB in `types/`.

Migrations that depend on a script having been run record the fact in `app.migration_gates`
and refuse to apply without it — see `20260805040000_body_md_canonical.sql`, and
`reports/HANDOVER.md` for what is still outstanding.

## Conventions

- Server Components fetch via `lib/supabase/*`; Client Components mutate via `/api/*`
  fetches then `router.refresh()`.
- When touching Next.js APIs, check `node_modules/next/dist/docs/` — this is Next 16 and
  may differ from training data (see AGENTS.md).

## Local setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase URL + anon key. For
   full local auth, disable "Confirm email" in Supabase → Auth → Providers (dev only)
   so signup yields an immediate session.
2. `pnpm dev`, open http://localhost:3000, sign up (creates a workspace + default spaces).

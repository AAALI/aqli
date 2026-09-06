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
| Styling | Tailwind CSS v4 | Config is CSS-first in `src/app/globals.css` (`@import "tailwindcss"`, `@plugin "..."`). No `tailwind.config.ts`. |
| DB / Auth | Supabase (Postgres + pgvector + Auth) | Bring your own project; migrations in `supabase/migrations/`. |
| Editor | **Tiptap v3** | `Placeholder` imports from `@tiptap/extensions`. |
| Package manager | pnpm | Not npm/yarn. |

## Commands

```bash
pnpm dev        # local dev (Turbopack)
pnpm build      # production build
pnpm typecheck  # tsc --noEmit
pnpm lint       # eslint
pnpm test       # vitest
pnpm test:sql   # boots a throwaway Postgres, replays every migration, runs supabase/tests/
pnpm preflight  # is this installation in the state the code expects? (needs SUPABASE_SERVICE_KEY)
pnpm import     # bring in a markdown/zip or Confluence export (dry run unless --apply)
pnpm export     # the whole workspace as markdown + images, deterministic and re-importable
```

## Where things live

| Path | What |
|---|---|
| `src/` | All application code: `src/app` (routes), `src/components`, `src/lib`, `src/types`, plus `middleware.ts` and `instrumentation-client.ts`. The `@/*` alias resolves to `src/*`. |
| `scripts/`, `supabase/` | Operator scripts (run via pnpm) and the database: migrations, tests, rollbacks. Both sit outside `src/` because neither ships in the app bundle. |
| `docs/architecture.md`, `docs/technical-spec.md` | The design and its implementation detail. |
| `docs/moving-from-confluence.md` | The migration playbook for operators. |
| `design/v3/` | Current design handoff — brief, journeys, CSS, two runnable HTML prototypes, a screenshot per frame. Read `design/v3/BRIEF.md` before touching UI. |
| `docs/roadmap.md`, `docs/adoption.md` | What's next, and what has to be true before a company can move onto Aqli. |
| `reports/` | Findings and handover notes from migrations already run. |

## Architecture decisions worth knowing

- **Auth model:** Supabase Auth (email/password) via `@supabase/ssr`. `middleware.ts`
  refreshes the session and gates `/w/*` routes. There is **no NextAuth** — Supabase
  handles auth directly.
- **RLS-first data access:** `src/lib/supabase/*` use the **request-scoped, RLS-respecting**
  server client (`createServerSupabaseClient`), not the service-role key. RLS policies
  enforce workspace membership at the DB layer. API routes additionally gate on
  `auth.getUser()`.
- **Service-role access goes through `src/lib/db`** (spec §2.4). `scoped(workspaceId)` returns a
  `ScopedClient` that appends the workspace predicate to every select/update/delete and stamps
  `workspace_id` onto every insert, so a query cannot leave its workspace even if the caller
  forgets. An ESLint `no-restricted-imports` rule bans building a raw service client outside
  `src/lib/db/`. `unscoped(reason)` is the escape hatch for queries that genuinely cannot be scoped
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
  document moved under a proposal. The rules live in `src/lib/merge/disposition.ts` and,
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
- **Comments** (`doc_comments`) hold two things: what people type (`comment`), and the review
  trail (`review_request`, `approval`, `rejection`, `change_request`) — everything the review
  path writes on the service client. One thread, but the trail is undeletable by anyone, and
  the insert policy pins clients to `comment` so the trail cannot be forged. Unlike the rest of `src/lib/supabase/*`, `comments.ts` both reads *and*
  writes on the RLS client — the policies added in `20260808000000` already decide who may
  post, so the service client would only step around them. Mentions live in the comment body
  as `@[Name](user:<uuid>)` (`src/lib/mentions.ts`) and are **never** doc-body nodes: the
  markdown allowlist stays as small as it is on purpose.

## Data model (Supabase)

`workspaces` → `spaces` → `docs` (+ `revisions`, `proposals`, `doc_comments`), `members`
(workspace↔user role). `docs.parent_doc_id` + `position` make the page tree: the cycle
guard, the depth cap, one-space-per-subtree and re-parenting on delete are all triggers,
because four write paths reach that table.
`api_keys` carry an accountable `owner_user_id` and `scopes`. Schema lives in
`supabase/migrations/`; helper functions live in the `app` schema, with thin `public` shims
because PostgREST cannot reach `app`. Types mirror the DB in `src/types/`.

Migrations that depend on a script having been run record the fact in `app.migration_gates`
and refuse to apply without it — see `20260805040000_body_md_canonical.sql`, and
`reports/HANDOVER.md` for what is still outstanding.

## Conventions

- Server Components fetch via `src/lib/supabase/*`; Client Components mutate via `/api/*`
  fetches then `router.refresh()`.
- When touching Next.js APIs, check `node_modules/next/dist/docs/` — this is Next 16 and
  may differ from training data (see AGENTS.md).

## Local setup

1. Copy `.env.example` to `.env.local` and fill in your Supabase URL + anon key. For
   full local auth, disable "Confirm email" in Supabase → Auth → Providers (dev only)
   so signup yields an immediate session.
2. `pnpm dev`, open http://localhost:3000, sign up (creates a workspace + default spaces).

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

## Architecture decisions worth knowing

- **Auth model:** Supabase Auth (email/password) via `@supabase/ssr`. `middleware.ts`
  refreshes the session and gates `/w/*` routes. There is **no NextAuth** — Supabase
  handles auth directly.
- **RLS-first data access:** `lib/supabase/*` use the **request-scoped, RLS-respecting**
  server client (`createServerSupabaseClient`), not the service-role key. RLS policies
  enforce workspace membership at the DB layer. API routes additionally gate on
  `auth.getUser()`.
- **Service-role client** (`createServiceClient` in `lib/supabase/server.ts`, requires
  `SUPABASE_SERVICE_KEY`) bypasses RLS — it is used by the agent API and background
  pipelines. Any route using it MUST verify workspace membership itself.
- **Workspace bootstrap:** signup can't insert a workspace under RLS (no membership yet),
  so a `SECURITY DEFINER` Postgres function `create_workspace_for_user(name, slug)`
  creates the workspace + admin membership + default spaces atomically.
- **Markdown:** `body_json` (Tiptap JSON) is the editor source of truth. `body_md` is
  regenerated on every save by `lib/markdown/tiptap-to-md.ts` and powers full-text search
  (`search_vector` tsvector, maintained by a DB trigger) and `.md` export.
- **Versions:** `doc_versions` snapshots are written on create and on status change
  (see `lib/supabase/docs.ts` → `snapshotVersion`).
- **Autosave:** 2s debounce in `DocEditorClient`; title saves on blur.

## Data model (Supabase)

`workspaces` → `spaces` → `docs` (+ `doc_versions`), `members` (workspace↔user role).
Schema lives in `supabase/migrations/`. Types mirror the DB in `types/`.

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

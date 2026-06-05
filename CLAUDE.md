@AGENTS.md

# Aqli — Project Guide for Claude

> The open source shared context layer for human-agent teams. Humans write docs,
> agents read context and write output, humans review and approve.

This file orients any Claude/agent session working in this repo. Product specs
live in `aqli-product-docs.md` (PRD + architecture) and `aqli-week1-claude-code.md`
(the Week 1 build brief). **Read those before making product decisions.**

## Stack (as actually built)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | `@latest` resolved to 16, not the spec's 15. App Router only. Route `params` are `Promise`s — always `await` them. |
| Language | TypeScript (strict) | No `any`. |
| Styling | Tailwind CSS v4 | Config is CSS-first in `app/globals.css` (`@import "tailwindcss"`, `@plugin "..."`). No `tailwind.config.ts`. |
| DB / Auth | Supabase (Postgres + Auth) | Project ref `bxhagsiaenvcksckhize` (name "Aqli", eu-central-1). |
| Editor | **Tiptap v3** | Spec said v2; upgraded to current v3. `Placeholder` imports from `@tiptap/extensions`. |
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
  refreshes the session and gates `/w/*` routes. There is **no NextAuth** despite the
  spec's `app/api/auth/[...nextauth]` entry — Supabase handles auth directly.
- **RLS-first data access:** `lib/supabase/*` use the **request-scoped, RLS-respecting**
  server client (`createServerSupabaseClient`), not the service-role key. RLS policies
  enforce workspace membership at the DB layer. API routes additionally gate on
  `auth.getUser()`.
- **Service-role client** (`createServiceClient`) exists in `lib/supabase/server.ts` but
  is unused in Week 1 and requires `SUPABASE_SERVICE_KEY`. Reserved for Week 2 agent/
  background tasks that must bypass RLS.
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
Full schema applied via migrations `aqli_week1_core_schema` and `aqli_create_workspace_rpc`.
Types mirror the DB in `types/`.

## Conventions

- Server Components fetch via `lib/supabase/*`; Client Components mutate via `/api/*`
  fetches then `router.refresh()`.
- Keep Week 1 scope tight: **no** agent API, RAG, embeddings, or AI features yet
  (those are Week 2 per the build brief).
- When touching Next.js APIs, check `node_modules/next/dist/docs/` — this is Next 16 and
  may differ from training data (see AGENTS.md).

## Local setup

1. `.env.local` is pre-filled with the Supabase URL + anon key. For full local auth,
   disable "Confirm email" in Supabase → Auth → Providers (dev only) so signup yields an
   immediate session.
2. `pnpm dev`, open http://localhost:3000, sign up (creates a workspace + default spaces).
3. Seeded test accounts (`e2e@aqli.dev`, `newuser@aqli.dev`) exist for quick login —
   credentials and re-seed SQL are in `DEV_NOTES.local.md` (gitignored).

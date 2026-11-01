# End-to-end tests

Playwright, against a running Aqli and a **real Supabase project**. These are
the tests that catch what the unit suite cannot: RLS, PostgREST embeds, the
merge engine, the agent API behind a minted key.

```bash
pnpm test:e2e            # starts `pnpm dev` if nothing is on :3000
pnpm test:e2e --ui       # step through in the inspector
E2E_BASE_URL=https://preview.example pnpm test:e2e   # against a deployed preview
```

Needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_KEY` in the environment (`.env.local` is read by `next dev`;
export the service key for the setup project too). The first run also needs
`pnpm exec playwright install chromium`.

**Use a throwaway database.** `global.setup.ts` creates a confirmed user with
a password through the admin API; the journey creates a workspace under it;
`global.teardown.ts` deletes both. A Supabase branch or `supabase start` is the
right target. Nothing here is designed to be safe against production data.

The journey signs in through the password fallback on `/login` because the
link email cannot be read from a test. The magic-link path itself is covered
by the form tests in `src/components/settings/__tests__/actions.test.ts`.

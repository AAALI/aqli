import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one place in the codebase that builds a service-role Supabase client.
 *
 * The service role bypasses RLS entirely, so every query it runs carries the
 * whole database in its blast radius — a missing `workspace_id` predicate is a
 * cross-tenant read, not a bug you notice in review. An ESLint
 * `no-restricted-imports` rule bans this module outside `lib/db/`, which turns
 * that discipline problem into a lint error (spec §2.4).
 *
 * Reach for `scoped()` or `withWorkspace()` in `./scoped`. `unscoped()` is the
 * escape hatch for the handful of queries that genuinely cannot be scoped, and
 * it demands a written reason.
 */
function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Internal to `lib/db` — the raw, unfiltered client. */
export function rawServiceClient(): SupabaseClient {
  return serviceClient();
}

/**
 * A service-role client with no workspace filter, for the queries that cannot
 * have one: resolving an API key hash to its workspace, deduplicating a
 * webhook before its workspace is known, and the like.
 *
 * `reason` is not used at runtime. It exists so that every unscoped query has
 * to say out loud why it is unscoped, and so `grep -r 'unscoped('` lists them.
 */
export function unscoped(reason: string): SupabaseClient {
  if (!reason) throw new Error("unscoped() requires a reason");
  return serviceClient();
}

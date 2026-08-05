/**
 * Server-side feature flags.
 *
 * Kept as environment variables rather than a flag service: these gate a data
 * migration, so the value has to be identical for every request in a deploy
 * and has to be legible in a rollback. A percentage rollout of "which table is
 * the source of truth" is not a thing anyone wants to debug.
 */

function on(name: string): boolean {
  const v = process.env[name];
  return v === "1" || v === "true";
}

/**
 * Route human document saves through `propose → merge` instead of writing
 * `docs` directly (spec §9, step 4).
 *
 * Off, every save is a direct update, exactly as before. On, every save
 * becomes a proposal that the space's review policy either merges immediately
 * or queues. Every space defaults to `review_agents`, under which humans
 * merge — so with no other change, turning this on is behaviour-neutral from
 * the user's seat, and what it buys is a real revision history.
 */
export function mergeEngineEnabled(): boolean {
  return on("AQLI_MERGE_ENGINE");
}

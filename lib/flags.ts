/**
 * Server-side feature flags.
 *
 * Kept as environment variables rather than a flag service: these gate a data
 * migration, so the value has to be identical for every request in a deploy
 * and has to be legible in a rollback. A percentage rollout of "which table is
 * the source of truth" is not a thing anyone wants to debug.
 */

function offUnlessSet(name: string): boolean {
  const v = process.env[name];
  return !(v === "0" || v === "false");
}

/**
 * Route human document saves through `propose → merge` instead of writing
 * `docs` directly (spec §9, step 4).
 *
 * On since step 6, and on by default: `body_md` is canonical, and the merge
 * engine is what writes it. Set `AQLI_MERGE_ENGINE=0` to fall back to direct
 * `docs` writes.
 *
 * That fallback is a rollback lever, not a supported mode. With it off, saves
 * stop producing revisions, so the history for anything edited while it is off
 * has a hole in it. Turn it off to get out of trouble, not to stay there.
 */
export function mergeEngineEnabled(): boolean {
  return offUnlessSet("AQLI_MERGE_ENGINE");
}

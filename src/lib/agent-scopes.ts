/**
 * What an agent key may do.
 *
 * Split out from `lib/api-keys.ts` deliberately: that module imports
 * `node:crypto` and the service-role client from `lib/db`, so a Client
 * Component importing a constant from it would drag server-only code into the
 * browser bundle. This file is pure data and safe on both sides.
 */
import type { AgentScope } from "@/lib/merge/disposition";

/** Matches the `agent_scope` enum in the database. */
export const AGENT_SCOPES: AgentScope[] = ["read", "propose", "write"];

/**
 * The scopes a key gets when nobody says otherwise — and the DB column
 * default. An agent can read approved context and submit proposals; those
 * proposals queue for a human.
 */
export const DEFAULT_AGENT_SCOPES: AgentScope[] = ["read", "propose"];

/**
 * Normalize a requested scope set.
 *
 * `read` is always included: every agent endpoint reads before it writes, and a
 * key without it is one that silently does nothing. Unknown values are dropped
 * rather than rejected so a newer client cannot brick key creation.
 */
export function normalizeScopes(requested: unknown): AgentScope[] {
  const asked = Array.isArray(requested) ? requested : [];
  const kept = AGENT_SCOPES.filter((scope) => asked.includes(scope));
  return kept.includes("read") ? kept : ["read", ...kept];
}

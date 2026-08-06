/**
 * Postgres error codes we translate into HTTP rather than letting them escape
 * as a 500. A `throw` out of a route handler renders Next's error page, so the
 * client's `res.json()` fails to parse and every cause collapses into the same
 * unhelpful message — which is how a taken workspace URL used to present as
 * "Could not create workspace" with no way forward.
 */

/** unique_violation */
export const PG_UNIQUE_VIOLATION = "23505";
/** check_violation */
export const PG_CHECK_VIOLATION = "23514";
/** foreign_key_violation */
export const PG_FOREIGN_KEY_VIOLATION = "23503";

type PostgresError = { code?: string; message?: string; details?: string };

export function pgCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const code = (err as PostgresError).code;
  return typeof code === "string" ? code : undefined;
}

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (pgCode(err) !== PG_UNIQUE_VIOLATION) return false;
  if (!constraint) return true;
  const e = err as PostgresError;
  return `${e.message ?? ""} ${e.details ?? ""}`.includes(constraint);
}

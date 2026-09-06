/**
 * "This page couldn't load" is what a database that is behind looks like from
 * the outside.
 *
 * A server component that selects a column, or calls a function, that its
 * migration never created throws a PostgREST error. Next.js strips the message
 * in production and renders the generic error screen, so the operator sees a
 * blank page with a digest and no way to learn that the fix is one `supabase db
 * push`. That is the failure this module exists to name.
 *
 * It is deliberately reactive rather than a probe. The question "is this
 * installation behind?" is expensive to ask on every render and impossible to
 * ask completely; the question "did *this* query fail because something is
 * missing?" is free, because the error is already in hand, and it fires exactly
 * when it matters.
 */
import { SCHEMA_OWNERS } from "./schema-owners";

/**
 * Postgres and PostgREST codes that mean "the schema does not have that".
 *
 * Kept narrow on purpose. A permission error or a constraint violation is a
 * bug in the code or bad data, and telling an operator to run migrations for
 * one would send them somewhere there is nothing to find.
 */
const DRIFT_CODES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "42883", // undefined_function
  "42704", // undefined_object (a type, an index)
  "PGRST202", // PostgREST: no function matching that name in the schema cache
  "PGRST204", // PostgREST: no column matching that name in the schema cache
]);

export type SchemaDrift = {
  /** The table, column or function the database does not have. */
  object: string | null;
  /** The migration that creates it, when the name gives it away. */
  migration: string | null;
  /** The database's own words, for the log and for an operator who wants them. */
  detail: string;
};

type Postgrestish = { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };

function asPostgrestish(error: unknown): Postgrestish | null {
  return typeof error === "object" && error !== null ? (error as Postgrestish) : null;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * The object a "does not exist" message is complaining about.
 *
 * Postgres phrases these consistently enough to quote back — `relation "docs"
 * does not exist`, `column docs.parent_doc_id does not exist`, `function
 * public.blocked_space_ids(uuid, uuid) does not exist`. PostgREST's schema-cache
 * errors name it in `message` instead. A miss returns null and the screen says
 * "something the code expects", which is still better than a digest.
 */
function namedObject(message: string): string | null {
  const quoted = /(?:relation|column|function|type|table)\s+"?([\w.]+(?:\([^)]*\))?)"?\s+does not exist/i.exec(
    message,
  );
  if (quoted) return quoted[1];

  const schemaCache = /Could not find (?:the )?(?:function|column|table)\s+([\w.]+(?:\([^)]*\))?)/i.exec(
    message,
  );
  if (schemaCache) return schemaCache[1];

  return null;
}

/**
 * The migration that creates an object.
 *
 * Tries the most specific form first — `docs.parent_doc_id` before
 * `parent_doc_id` — so a column that shares a name across tables resolves to
 * the right one where the error gave us the table. Functions arrive
 * schema-qualified and with an argument list; both are tried, stripped.
 *
 * Returns null rather than a guess. The screen then says the database is
 * behind without naming a file, which is honest; naming the wrong file sends
 * an operator somewhere there is nothing to find.
 */
export function migrationFor(object: string | null): string | null {
  if (!object) return null;
  const bare = object.replace(/\(.*$/, "").toLowerCase();

  const candidates = [bare];
  const parts = bare.split(".");
  if (parts.length > 2) candidates.push(parts.slice(-2).join(".")); // public.docs.col → docs.col
  if (parts.length > 1) candidates.push(parts[parts.length - 1]);

  for (const key of candidates) {
    const owner = SCHEMA_OWNERS[key];
    if (owner) return `${owner}.sql`;
  }
  return null;
}

/**
 * Is this the error of a database that is behind? If so, what is missing?
 *
 * Returns null for everything else, so a caller can rethrow and let the normal
 * error boundary handle a genuine bug.
 */
export function schemaDrift(error: unknown): SchemaDrift | null {
  const e = asPostgrestish(error);
  if (!e) return null;

  const code = str(e.code);
  const message = str(e.message);
  const details = str(e.details);
  const hint = str(e.hint);
  const haystack = [message, details, hint].filter(Boolean).join(" — ");

  // The code is the reliable signal. The message test is the fallback for the
  // paths that wrap a database error in something plainer on the way out.
  const looksLikeDrift =
    DRIFT_CODES.has(code) ||
    /does not exist|schema cache|could not find the function/i.test(haystack);
  if (!looksLikeDrift) return null;

  const object = namedObject(haystack);
  return {
    object,
    migration: migrationFor(object),
    detail: haystack || `database error ${code || "(no code)"}`,
  };
}

/**
 * Run a loader, and say whether it failed because the database is behind.
 *
 * A tuple rather than a throw: the caller is a Server Component that wants to
 * render a different screen, not unwind. Anything that is not drift is
 * rethrown, because a real bug should still reach the error boundary and the
 * logs rather than being reported to the operator as a missing migration.
 */
export async function loadOrDrift<T>(load: () => Promise<T>): Promise<
  { ok: true; data: T } | { ok: false; drift: SchemaDrift }
> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    const drift = schemaDrift(error);
    if (!drift) throw error;
    // The operator gets the screen; whoever runs the deployment gets the log.
    console.error("[aqli] schema drift:", drift.detail);
    return { ok: false, drift };
  }
}

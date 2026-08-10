import { rawServiceClient } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Workspace-scoped service-role access (spec §2.4).
 *
 * Agents authenticate with a bearer key rather than a Supabase session, so RLS
 * does not apply to their requests and the API has to use the service role.
 * That is exactly the shape that produced cross-workspace reads before. This
 * makes the scoping structural instead of remembered: every `.from(table)`
 * that goes through a `ScopedClient` gets its workspace predicate appended, and
 * every insert gets its `workspace_id` stamped, whether or not the caller
 * thought about it.
 *
 * It is not a substitute for RLS. Human request paths still use the
 * request-scoped client in `lib/supabase/server.ts`, where the database
 * enforces membership.
 */

type QueryBuilder = ReturnType<SupabaseClient["from"]>;

/**
 * How each table is scoped to a workspace. Tables are opted in explicitly:
 * an unlisted table throws rather than being silently queried unscoped, so
 * adding a table to the schema forces a decision here.
 */
const SCOPE_COLUMN: Record<string, string | null> = {
  api_keys: "workspace_id",
  doc_activity: "workspace_id",
  doc_chunks: "workspace_id",
  doc_comments: "workspace_id",
  docs: "workspace_id",
  document_links: "workspace_id",
  integration_connections: "workspace_id",
  integration_secrets: "workspace_id",
  integration_webhook_events: "workspace_id",
  invitations: "workspace_id",
  members: "workspace_id",
  proposals: "workspace_id",
  revisions: "workspace_id",
  spaces: "workspace_id",
  // Keyed by its own id rather than a workspace_id column.
  workspaces: "id",
  // `doc_versions` has no workspace column. It is reachable only through a
  // doc_id the caller already resolved from a scoped `docs` query, so the
  // scoping happened one step earlier. Step 6 retires the table for
  // `revisions`, which is scoped properly.
  doc_versions: null,
};

const FILTERED = new Set(["select", "update", "delete"]);
const STAMPED = new Set(["insert", "upsert"]);

function stamp(values: unknown, column: string, workspaceId: string): unknown {
  if (Array.isArray(values)) {
    return values.map((v) => stamp(v, column, workspaceId));
  }
  if (values && typeof values === "object") {
    return { ...(values as Record<string, unknown>), [column]: workspaceId };
  }
  return values;
}

export type Actor =
  | { type: "human"; userId: string; name?: string | null }
  | { type: "agent"; keyId: string; agentId?: string | null; ownerUserId?: string | null }
  | { type: "system"; label: string };

export type Scope = { workspaceId: string; actor: Actor };

export class ScopedClient {
  constructor(
    private readonly raw: SupabaseClient,
    readonly workspaceId: string,
  ) {}

  /**
   * As `supabase.from(table)`, but the workspace predicate is not optional.
   * Returns the ordinary PostgREST builder, so every method the codebase
   * already uses keeps working and keeps its types.
   */
  from(table: string): QueryBuilder {
    if (!(table in SCOPE_COLUMN)) {
      throw new Error(
        `ScopedClient: no scoping rule for table "${table}". Add it to SCOPE_COLUMN in lib/db/scoped.ts.`,
      );
    }

    const builder = this.raw.from(table);
    const column = SCOPE_COLUMN[table];
    if (column === null) return builder;

    const workspaceId = this.workspaceId;
    return new Proxy(builder, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver) as unknown;
        if (typeof value !== "function" || typeof prop !== "string") return value;
        const method = value as (...args: unknown[]) => unknown;

        if (FILTERED.has(prop)) {
          return (...args: unknown[]) => {
            const q = method.apply(target, args) as {
              eq(c: string, v: string): unknown;
            };
            return q.eq(column, workspaceId);
          };
        }

        if (STAMPED.has(prop)) {
          return (values: unknown, ...rest: unknown[]) =>
            method.apply(target, [stamp(values, column, workspaceId), ...rest]);
        }

        return method.bind(target);
      },
    }) as QueryBuilder;
  }

  /** RPC is passed through — the functions in the `app` schema scope themselves. */
  get rpc(): SupabaseClient["rpc"] {
    return this.raw.rpc.bind(this.raw);
  }
}

/** A client pinned to one workspace. */
export function scoped(workspaceId: string): ScopedClient {
  if (!workspaceId) throw new Error("scoped() requires a workspace id");
  return new ScopedClient(rawServiceClient(), workspaceId);
}

/**
 * Run `fn` against a client that cannot leave `scope.workspaceId`.
 *
 * The callback shape is what makes the boundary legible at the call site: the
 * scope is established once, in one place, and everything inside inherits it.
 */
export async function withWorkspace<T>(
  scope: Scope,
  fn: (db: ScopedClient, scope: Scope) => Promise<T>,
): Promise<T> {
  return fn(scoped(scope.workspaceId), scope);
}

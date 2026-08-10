import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scoped, unscoped } from "@/lib/db";
import type {
  IntegrationConnection,
  IntegrationProvider,
  IntegrationStatus,
} from "@/types/integration";

export function composioUserId(workspaceId: string, userId: string) {
  return `aqli:${workspaceId}:${userId}`;
}

export async function listIntegrationConnections(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("provider", { ascending: true });
  if (error) throw error;
  return (data ?? []) as IntegrationConnection[];
}

export async function getIntegrationConnection(
  workspaceId: string,
  provider: IntegrationProvider,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw error;
  return data as IntegrationConnection | null;
}

export async function upsertIntegrationConnection(input: {
  workspaceId: string;
  userId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedAccountId?: string | null;
  triggerIds?: string[];
  defaultSpaceId?: string | null;
  metadata?: Record<string, unknown>;
  lastError?: string | null;
}) {
  const { data, error } = await scoped(input.workspaceId)
    .from("integration_connections")
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        provider: input.provider,
        status: input.status,
        composio_user_id: composioUserId(input.workspaceId, input.userId),
        connected_account_id: input.connectedAccountId ?? null,
        trigger_ids: input.triggerIds ?? [],
        default_space_id: input.defaultSpaceId ?? null,
        metadata: input.metadata ?? {},
        last_error: input.lastError ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,provider" },
    )
    .select()
    .single();
  if (error) throw error;
  return data as IntegrationConnection;
}

export async function updateIntegrationConnection(
  workspaceId: string,
  id: string,
  updates: Partial<Pick<
    IntegrationConnection,
    | "status"
    | "connected_account_id"
    | "trigger_ids"
    | "github_hook_ids"
    | "default_space_id"
    | "metadata"
    | "last_event_at"
    | "last_error"
  >>,
) {
  const { data, error } = await scoped(workspaceId)
    .from("integration_connections")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as IntegrationConnection;
}

/**
 * Resolve an inbound GitHub delivery to the connection that registered the hook.
 *
 * Unscoped by necessity, for the same reason the Composio lookup below was: the
 * `X-GitHub-Hook-ID` header is the only identifier a delivery carries before it
 * has been verified, and finding out which workspace it belongs to is the whole
 * point of the query. The signature is checked immediately afterwards, against
 * the secret this row points at — so an attacker who guesses a hook id learns
 * nothing and gets a 401.
 */
export async function getServiceIntegrationByHookId(
  hookId: number,
  provider: IntegrationProvider,
) {
  const supabase = unscoped(
    "a GitHub webhook identifies itself only by its hook id; resolving it to a workspace is what this query is for",
  );
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .contains("github_hook_ids", [hookId])
    .eq("provider", provider)
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as IntegrationConnection | null;
}

/**
 * The GitHub token and webhook secret for a connection.
 *
 * `getIntegrationSecret` and `saveIntegrationSecret` both go through `scoped()`
 * — the service client — and must keep doing so. `integration_secrets` has RLS
 * enabled with **no policies**, which denies every role that respects RLS; the
 * service role is the only thing that can reach it, and that is the protection,
 * not an oversight. Switching either to the request-scoped client would make
 * them silently return nothing. See `20260809000000_github_direct_tokens.sql`
 * for why the token cannot live on `integration_connections` itself.
 */
export async function getIntegrationSecret(
  workspaceId: string,
  connectionId: string,
): Promise<{ access_token: string; webhook_secret: string } | null> {
  const { data, error } = await scoped(workspaceId)
    .from("integration_secrets")
    .select("access_token, webhook_secret")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw error;
  return (data as { access_token: string; webhook_secret: string } | null) ?? null;
}

export async function saveIntegrationSecret(input: {
  workspaceId: string;
  connectionId: string;
  accessToken: string;
  webhookSecret: string;
}): Promise<void> {
  const { error } = await scoped(input.workspaceId)
    .from("integration_secrets")
    .upsert(
      {
        connection_id: input.connectionId,
        access_token: input.accessToken,
        webhook_secret: input.webhookSecret,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "connection_id" },
    );
  if (error) throw error;
}

// No `deleteIntegrationSecret`. There is no disconnect flow to call it from,
// `saveIntegrationSecret` upserts on `connection_id` so reconnecting replaces
// the row, and the table's foreign key cascades when a connection is deleted —
// asserted in supabase/tests/integration_secrets.sql. Adding one now would be a
// function with no caller.

// --- Composio, kept for reference --------------------------------------------
//
// The Composio webhook lookup, replaced by `getServiceIntegrationByHookId`
// above. `composio_user_id` is still written by `upsertIntegrationConnection`,
// so restoring this needs no backfill.
//
// export async function getServiceIntegrationByComposioUser(
//   composioId: string,
//   provider: IntegrationProvider,
// ) {
//   const supabase = unscoped(
//     "a Composio webhook identifies itself only by composio_user_id; resolving it to a workspace is what this query is for",
//   );
//   const { data, error } = await supabase
//     .from("integration_connections")
//     .select("*")
//     .eq("composio_user_id", composioId)
//     .eq("provider", provider)
//     .eq("status", "connected")
//     .order("updated_at", { ascending: false })
//     .limit(1)
//     .maybeSingle();
//   if (error) throw error;
//   return data as IntegrationConnection | null;
// }

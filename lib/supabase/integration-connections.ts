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
 * Resolve a Composio webhook back to the connection that produced it.
 *
 * Unscoped by necessity: `composio_user_id` is the only identifier the webhook
 * carries, and finding out which workspace it belongs to is the whole point of
 * the query.
 */
export async function getServiceIntegrationByComposioUser(
  composioId: string,
  provider: IntegrationProvider,
) {
  const supabase = unscoped(
    "a Composio webhook identifies itself only by composio_user_id; resolving it to a workspace is what this query is for",
  );
  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("composio_user_id", composioId)
    .eq("provider", provider)
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as IntegrationConnection | null;
}

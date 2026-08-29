import crypto from "crypto";
import { scoped, unscoped } from "@/lib/db";
import { DEFAULT_AGENT_SCOPES } from "@/lib/agent-scopes";
import type { AgentScope } from "@/lib/merge/disposition";
import type { ApiKey, ApiKeyWithSecret } from "@/types/api-key";

/**
 * Generate a new API key.
 * Format: aqli_<48 random hex chars>. We store only a SHA-256 hash; the plain
 * key is returned exactly once, at creation.
 */
export async function createApiKey(
  workspaceId: string,
  name: string,
  createdBy: string,
  scopes: AgentScope[] = DEFAULT_AGENT_SCOPES,
): Promise<ApiKeyWithSecret> {
  const rawKey = `aqli_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12) + "…";

  const { data, error } = await scoped(workspaceId)
    .from("api_keys")
    .insert({
      workspace_id: workspaceId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      created_by: createdBy,
      scopes,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...(data as ApiKey), secret: rawKey };
}

/**
 * Replace a key's scopes. The caller (`/api/keys/[id]`) has already resolved
 * the key's workspace and checked that the caller is an admin of it.
 */
export async function updateApiKeyScopes(
  id: string,
  scopes: AgentScope[],
): Promise<void> {
  const supabase = unscoped(
    "the caller resolved this key's workspace and verified admin rights before calling",
  );
  const { error } = await supabase
    .from("api_keys")
    .update({ scopes })
    .eq("id", id);
  if (error) throw error;
}

export async function validateApiKey(
  rawKey: string,
): Promise<{
  valid: boolean;
  workspaceId: string | null;
  keyId: string | null;
  /**
   * The key's scopes, so a caller can refuse an action before attempting it.
   * The merge engine reads them too, but it only decides merge-vs-queue and
   * never refuses — so a `read`-only key would otherwise be able to queue
   * proposals, which is not what `DEFAULT_AGENT_SCOPES` promises.
   */
  scopes: AgentScope[];
  /**
   * The member this key acts for. Every agent read inherits their space
   * visibility, so a private space the owner is not in is not in the agent's
   * answers either (ADOPTION.md F-4).
   */
  ownerUserId: string | null;
}> {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  // Unscoped by necessity: the bearer token is the only thing the request
  // carries, and this query is how its workspace is established. Everything
  // downstream of it is scoped to the workspace this returns.
  const supabase = unscoped(
    "a bearer key identifies itself only by its hash; resolving it to a workspace is what this query is for",
  );

  const { data } = await supabase
    .from("api_keys")
    .select("id, workspace_id, revoked_at, last_used_at, scopes, created_by")
    .eq("key_hash", keyHash)
    .single();

  if (!data || data.revoked_at) {
    return { valid: false, workspaceId: null, keyId: null, scopes: [], ownerUserId: null };
  }

  // Best-effort last-used timestamp. It's a UI freshness signal, so skip the
  // write unless it's stale — otherwise every agent request pays for an extra
  // DB write on the auth path.
  const lastUsed = data.last_used_at ? Date.parse(data.last_used_at) : 0;
  if (Date.now() - lastUsed > 60_000) {
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  return {
    valid: true,
    workspaceId: data.workspace_id,
    keyId: data.id,
    // A key predating the scopes column reads as null; treat it as the
    // documented default rather than as a key that can do nothing.
    scopes: (data.scopes as AgentScope[] | null) ?? DEFAULT_AGENT_SCOPES,
    ownerUserId: (data.created_by as string | null) ?? null,
  };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKey[]> {
  const { data, error } = await scoped(workspaceId)
    .from("api_keys")
    .select(
      "id, workspace_id, name, key_prefix, last_used_at, created_by, created_at, revoked_at, scopes",
    )
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApiKey[];
}

/**
 * Revoke by key id. The caller (`/api/keys/[id]`) has already resolved the
 * key's workspace and checked that the caller is an admin of it.
 */
export async function revokeApiKey(id: string): Promise<void> {
  const supabase = unscoped(
    "the caller resolved this key's workspace and verified admin rights before calling",
  );
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
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
): Promise<ApiKeyWithSecret> {
  const rawKey = `aqli_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12) + "…";

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      workspace_id: workspaceId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...(data as ApiKey), secret: rawKey };
}

export async function validateApiKey(
  rawKey: string,
): Promise<{ valid: boolean; workspaceId: string | null; keyId: string | null }> {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("api_keys")
    .select("id, workspace_id, revoked_at, last_used_at")
    .eq("key_hash", keyHash)
    .single();

  if (!data || data.revoked_at) {
    return { valid: false, workspaceId: null, keyId: null };
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

  return { valid: true, workspaceId: data.workspace_id, keyId: data.id };
}

export async function listApiKeys(workspaceId: string): Promise<ApiKey[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, workspace_id, name, key_prefix, last_used_at, created_by, created_at, revoked_at",
    )
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApiKey[];
}

export async function revokeApiKey(id: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

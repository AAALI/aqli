import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api-keys";

export type AgentContext = {
  workspaceId: string;
  keyId: string;
};

/**
 * Authenticate an agent request via `Authorization: Bearer aqli_…`.
 * Returns null when the key is missing, malformed, revoked, or unknown.
 */
export async function authenticateAgent(req: NextRequest): Promise<AgentContext | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith("aqli_")) return null;

  const { valid, workspaceId, keyId } = await validateApiKey(rawKey);
  if (!valid || !workspaceId || !keyId) return null;

  return { workspaceId, keyId };
}

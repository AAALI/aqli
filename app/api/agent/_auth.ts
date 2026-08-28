import { NextRequest } from "next/server";
import { validateApiKey } from "@/lib/api-keys";
import type { AgentScope } from "@/lib/merge/disposition";

export type AgentContext = {
  workspaceId: string;
  keyId: string;
  /** What this key may do. Read is always present (`normalizeScopes`). */
  scopes: AgentScope[];
  /**
   * The member this key acts for. Reads inherit their space visibility, so an
   * assistant cannot answer from a private space its owner cannot open.
   */
  ownerUserId: string | null;
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

  const { valid, workspaceId, keyId, scopes, ownerUserId } = await validateApiKey(rawKey);
  if (!valid || !workspaceId || !keyId) return null;

  return { workspaceId, keyId, scopes, ownerUserId };
}

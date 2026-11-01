import crypto from "crypto";
import { createServerSupabaseClient } from "./server";
import type { Invitation, Role } from "@/types/invitation";

/**
 * Create a pending invitation. The RLS policy on `invitations` enforces that
 * only workspace admins can insert. The token is the secret embedded in the
 * invite link — generated server-side with crypto-strong randomness.
 */
export async function createInvitation(
  workspaceId: string,
  email: string,
  role: Role,
  invitedBy: string,
): Promise<Invitation> {
  const supabase = await createServerSupabaseClient();
  const token = crypto.randomBytes(24).toString("base64url");
  const address = email.toLowerCase().trim();

  // Inviting the same address twice is a re-send, not a second invitation:
  // the pending row gets a fresh token, role and expiry, and the old link
  // stops working. Otherwise People fills up with duplicates of one person.
  const { data: existing } = await supabase
    .from("invitations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", address)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  const query = existing
    ? supabase
        .from("invitations")
        .update({ role, token, invited_by: invitedBy, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() })
        .eq("id", existing.id)
    : supabase
        .from("invitations")
        .insert({ workspace_id: workspaceId, email: address, role, token, invited_by: invitedBy });

  const { data, error } = await query.select().single();
  if (error) throw error;
  return data as Invitation;
}

/** Pending invitations for a workspace (admins only, via RLS). */
export async function listPendingInvitations(
  workspaceId: string,
): Promise<Invitation[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invitation[];
}

/** Revoke a pending invitation. RLS enforces admin-only. */
export async function revokeInvitation(id: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", id);
  if (error) throw error;
}

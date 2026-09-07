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

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      workspace_id: workspaceId,
      email: email.toLowerCase().trim(),
      role,
      token,
      invited_by: invitedBy,
    })
    .select()
    .single();

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

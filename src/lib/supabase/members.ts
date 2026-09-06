import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { WorkspaceMember } from "@/types/invitation";

/**
 * List members of a workspace with their auth email. Backed by a SECURITY
 * DEFINER RPC that checks the caller is a member before returning emails.
 */
export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_workspace_members", {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return (data ?? []) as WorkspaceMember[];
}

/**
 * Return the signed-in user's role in a workspace, or null if not a member.
 * Uses the request-scoped (RLS-respecting) client.
 */
export async function getMyRole(workspaceId: string): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.role ?? null;
}

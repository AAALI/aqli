import { cache } from "react";
import { createServerSupabaseClient, getUser } from "@/lib/supabase/server";
import type { WorkspaceMember } from "@/types/invitation";

/**
 * List members of a workspace with their auth email. Backed by a SECURITY
 * DEFINER RPC that checks the caller is a member before returning emails.
 */
export const listWorkspaceMembers = cache(async (
  workspaceId: string,
): Promise<WorkspaceMember[]> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_workspace_members", {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return (data ?? []) as WorkspaceMember[];
});

/**
 * Return the signed-in user's role in a workspace, or null if not a member.
 * Uses the request-scoped (RLS-respecting) client. Memoised per request: the
 * layout, the page and the actions on it all ask, and the answer is the same.
 */
export const getMyRole = cache(async (workspaceId: string): Promise<string | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  return data?.role ?? null;
});

import { createServerSupabaseClient } from "@/lib/supabase/server";

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

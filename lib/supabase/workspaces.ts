import { createServerSupabaseClient } from "./server";
import type { Workspace } from "@/types/workspace";

export async function getWorkspaceBySlug(slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data as Workspace;
}

export async function getMyWorkspaces() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Workspace[];
}

/**
 * Bootstraps a workspace for the current user via a SECURITY DEFINER RPC.
 * Creates the workspace, an admin membership, and default spaces.
 */
export async function createWorkspace(name: string, slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_workspace_for_user", {
    p_name: name,
    p_slug: slug,
  });
  if (error) throw error;
  return data as Workspace;
}

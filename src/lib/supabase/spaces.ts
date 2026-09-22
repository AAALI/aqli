import { createServerSupabaseClient } from "./server";
import type { Space } from "@/types/space";

export async function getSpaces(workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("spaces")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Space[];
}

/**
 * Published docs per space, for the sidebar's mono count.
 *
 * Counts published docs only: a draft is invisible to everyone but its author
 * (§3.2), so counting them would tell the rest of the team a number they
 * cannot reconcile with what they can see.
 */
export async function getSpaceDocCounts(
  workspaceId: string,
): Promise<Record<string, number>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("docs")
    .select("space_id")
    .eq("workspace_id", workspaceId)
    .neq("status", "draft")
    .neq("status", "archived");
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { space_id: string | null }[]) {
    if (row.space_id) counts[row.space_id] = (counts[row.space_id] ?? 0) + 1;
  }
  return counts;
}

export async function getSpaceBySlug(workspaceId: string, slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("spaces")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data as Space;
}

export async function createSpace(payload: {
  workspace_id: string;
  name: string;
  slug: string;
  icon?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("spaces")
    .insert({ ...payload, icon: payload.icon ?? "folder" })
    .select()
    .single();
  if (error) throw error;
  return data as Space;
}

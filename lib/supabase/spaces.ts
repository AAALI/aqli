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
    .insert({ ...payload, icon: payload.icon ?? "📄" })
    .select()
    .single();
  if (error) throw error;
  return data as Space;
}

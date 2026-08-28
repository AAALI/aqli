import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";

type Params = { params: Promise<{ id: string }> };

/**
 * Who is in a space, and who may approve in it (ADOPTION.md F-4).
 *
 * Reading the roster needs only workspace membership: a private space's
 * *existence* is not secret, and hiding who has access would make "ask someone
 * who can see it" impossible. Changing it is an admin's job.
 */
async function spaceWorkspace(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  spaceId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("spaces")
    .select("workspace_id")
    .eq("id", spaceId)
    .maybeSingle();
  return (data?.workspace_id as string | undefined) ?? null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase
    .from("space_members")
    .select("id, space_id, user_id, role, created_at")
    .eq("space_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ members: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const workspaceId = await spaceWorkspace(supabase, id);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((await getMyRole(workspaceId)) !== "admin")
    return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.user_id === "string" ? body.user_id : null;
  const role = body.role === "reviewer" ? "reviewer" : "member";
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  // Someone can only be added to a space in a workspace they already belong to
  // — otherwise a private space would become a way to hand an outsider access.
  const { data: member } = await supabase
    .from("members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member)
    return NextResponse.json(
      { error: "That person is not a member of this workspace" },
      { status: 400 },
    );

  const { data, error } = await supabase
    .from("space_members")
    .upsert(
      { workspace_id: workspaceId, space_id: id, user_id: userId, role },
      { onConflict: "space_id,user_id" },
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ member: data });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const workspaceId = await spaceWorkspace(supabase, id);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((await getMyRole(workspaceId)) !== "admin")
    return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 });

  const { error } = await supabase
    .from("space_members")
    .delete()
    .eq("space_id", id)
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

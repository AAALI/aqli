import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { slugify } from "@/lib/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getMyRole(id);
  if (role !== "admin")
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (typeof body.slug === "string" && body.slug.trim()) {
    updates.slug = slugify(body.slug.trim());
  }
  if (body.settings && typeof body.settings === "object") {
    // Merge into existing settings JSONB
    const { data: current } = await supabase
      .from("workspaces")
      .select("settings")
      .eq("id", id)
      .single();
    updates.settings = { ...(current?.settings ?? {}), ...body.settings };
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "That slug is already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workspace: data });
}

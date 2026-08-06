import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import type { ReviewPolicy } from "@/lib/merge/disposition";

type Params = { params: Promise<{ id: string }> };

const REVIEW_POLICIES: ReviewPolicy[] = ["open", "review_agents", "review_all"];

export async function PUT(req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const updates = await req.json();

  const patch: Record<string, unknown> = {};
  if (typeof updates.name === "string") patch.name = updates.name;
  if (typeof updates.icon === "string") patch.icon = updates.icon;

  if (updates.review_policy !== undefined) {
    if (!REVIEW_POLICIES.includes(updates.review_policy)) {
      return NextResponse.json(
        { error: `review_policy must be one of ${REVIEW_POLICIES.join(", ")}` },
        { status: 400 },
      );
    }

    // Who has to approve a change is a governance decision, not space
    // housekeeping like a name or an icon — so it needs admin, and the admin
    // check has to run against the space's own workspace.
    const { data: space } = await supabase
      .from("spaces")
      .select("workspace_id")
      .eq("id", id)
      .maybeSingle();
    if (!space)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if ((await getMyRole(space.workspace_id)) !== "admin")
      return NextResponse.json({ error: "Admins only" }, { status: 403 });

    patch.review_policy = updates.review_policy;
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await supabase
    .from("spaces")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ space: data });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase.from("spaces").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

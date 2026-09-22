import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import type { ReviewPolicy } from "@/lib/merge/disposition";

type Params = { params: Promise<{ id: string }> };

const REVIEW_POLICIES: ReviewPolicy[] = ["open", "review_agents", "review_all"];
const VISIBILITIES = ["open", "private"] as const;

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

  // The space's curated shelves (v3 §5.8): up to three Start here docs and an
  // ordered reading path. Plain id lists — the page resolves them, and a doc
  // that has since been deleted or made private simply does not render.
  const isIdList = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x));
  if (updates.start_here !== undefined) {
    if (!isIdList(updates.start_here) || updates.start_here.length > 3)
      return NextResponse.json({ error: "start_here takes up to three doc ids" }, { status: 400 });
    patch.start_here = updates.start_here;
  }
  if (updates.reading_path !== undefined) {
    if (!isIdList(updates.reading_path) || updates.reading_path.length > 12)
      return NextResponse.json({ error: "reading_path takes up to twelve doc ids" }, { status: 400 });
    patch.reading_path = updates.reading_path;
  }

  // Who may *read* a space, like who must approve a change, is a governance
  // decision rather than housekeeping: admins only, checked against the space's
  // own workspace.
  if (updates.visibility !== undefined) {
    if (!VISIBILITIES.includes(updates.visibility)) {
      return NextResponse.json(
        { error: `visibility must be one of ${VISIBILITIES.join(", ")}` },
        { status: 400 },
      );
    }

    const { data: space } = await supabase
      .from("spaces")
      .select("workspace_id")
      .eq("id", id)
      .maybeSingle();
    if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if ((await getMyRole(space.workspace_id)) !== "admin")
      return NextResponse.json({ error: "Admins only" }, { status: 403 });

    patch.visibility = updates.visibility;
  }

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

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSpaces, createSpace } from "@/lib/supabase/spaces";
import { slugify } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );

  const spaces = await getSpaces(workspaceId);
  return NextResponse.json({ spaces });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.workspace_id || !body.name)
    return NextResponse.json(
      { error: "workspace_id and name required" },
      { status: 400 },
    );

  const space = await createSpace({
    workspace_id: body.workspace_id,
    name: body.name,
    slug: body.slug ?? slugify(body.name),
    icon: body.icon,
  });
  return NextResponse.json({ space }, { status: 201 });
}

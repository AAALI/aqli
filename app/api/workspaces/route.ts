import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createWorkspace, getMyWorkspaces } from "@/lib/supabase/workspaces";
import { slugify } from "@/lib/utils";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaces = await getMyWorkspaces();
  return NextResponse.json({ workspaces });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.name)
    return NextResponse.json({ error: "name required" }, { status: 400 });

  const slug = body.slug
    ? slugify(body.slug)
    : `${slugify(body.name)}-${Math.random().toString(36).slice(2, 6)}`;

  const workspace = await createWorkspace(body.name, slug);
  return NextResponse.json({ workspace }, { status: 201 });
}

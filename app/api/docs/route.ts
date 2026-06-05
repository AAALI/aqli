import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDocs, createDoc } from "@/lib/supabase/docs";
import type { DocType, DocStatus } from "@/types/doc";

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

  const docs = await getDocs(workspaceId, {
    spaceId: searchParams.get("space_id") ?? undefined,
    type: (searchParams.get("type") as DocType) ?? undefined,
    status: (searchParams.get("status") as DocStatus) ?? undefined,
    limit: Number(searchParams.get("limit") ?? 50),
    offset: Number(searchParams.get("offset") ?? 0),
  });
  return NextResponse.json({ docs });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.workspace_id)
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );

  const doc = await createDoc({ ...body, owner_id: user.id });
  return NextResponse.json({ doc }, { status: 201 });
}

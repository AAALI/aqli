import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { searchDocs } from "@/lib/supabase/docs";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const workspaceId = searchParams.get("workspace_id");
  if (!query || !workspaceId)
    return NextResponse.json(
      { error: "q and workspace_id required" },
      { status: 400 },
    );

  const results = await searchDocs(workspaceId, query);
  return NextResponse.json({ results });
}

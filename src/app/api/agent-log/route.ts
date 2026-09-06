import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceAgentActivity } from "@/lib/supabase/activity";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );

  const activities = await getWorkspaceAgentActivity(workspaceId);
  return NextResponse.json({ activities });
}

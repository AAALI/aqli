import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { createApiKey, listApiKeys } from "@/lib/api-keys";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  // Must be a member of the workspace (service client bypasses RLS).
  if (!(await getMyRole(workspaceId)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const keys = await listApiKeys(workspaceId);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspace_id, name } = await req.json();
  if (!workspace_id || !name)
    return NextResponse.json(
      { error: "workspace_id and name required" },
      { status: 400 },
    );

  // Only admins can mint keys.
  const role = await getMyRole(workspace_id);
  if (role !== "admin")
    return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const key = await createApiKey(workspace_id, name, user.id);
  return NextResponse.json(
    { key, warning: "Store this key securely. It will not be shown again." },
    { status: 201 },
  );
}

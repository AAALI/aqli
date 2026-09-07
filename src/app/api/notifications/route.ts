import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import { getNotifications } from "@/lib/supabase/notifications";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const slug = new URL(req.url).searchParams.get("workspace");
  if (!slug) return NextResponse.json({ error: "workspace required" }, { status: 400 });

  const workspace = await getWorkspaceBySlug(slug).catch(() => null);
  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // getNotifications reads via the service-role client (it aggregates review /
  // stale / agent activity), so gate on membership here before bypassing RLS.
  const role = await getMyRole(workspace.id);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const notifications = await getNotifications(workspace.id);
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error(`getNotifications failed for workspace ${workspace.id}:`, err);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { createInvitation, listPendingInvitations } from "@/lib/supabase/invitations";
import type { Role } from "@/types/invitation";

const ROLES: Role[] = ["admin", "editor", "viewer"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  if ((await getMyRole(workspaceId)) !== "admin")
    return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const invitations = await listPendingInvitations(workspaceId);
  return NextResponse.json({ invitations });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspace_id, email, role } = await req.json();
  if (!workspace_id || !email)
    return NextResponse.json(
      { error: "workspace_id and email required" },
      { status: 400 },
    );
  if (!EMAIL_RE.test(String(email)))
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

  const finalRole: Role = ROLES.includes(role) ? role : "editor";

  if ((await getMyRole(workspace_id)) !== "admin")
    return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const invitation = await createInvitation(workspace_id, email, finalRole, user.id);
  return NextResponse.json({ invitation }, { status: 201 });
}

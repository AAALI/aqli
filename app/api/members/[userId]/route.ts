import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Role } from "@/types/invitation";

const ROLES: Role[] = ["admin", "editor", "viewer"];

type Params = { params: Promise<{ userId: string }> };

// The RPCs raise exceptions for every rule violation; map the known messages
// onto sensible statuses instead of a blanket 500.
function statusFor(message: string): number {
  if (message.includes("not authenticated")) return 401;
  if (message.includes("admins only")) return 403;
  if (message.includes("not a member")) return 404;
  return 400; // invalid role / last-admin guards
}

/** Change a member's role. Admin-only; the last admin cannot be demoted. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const { workspace_id, role } = await req.json();
  if (!workspace_id || !ROLES.includes(role))
    return NextResponse.json(
      { error: "workspace_id and role (admin|editor|viewer) required" },
      { status: 400 },
    );

  // The RPC re-checks that auth.uid() is a workspace admin and protects the
  // last admin, so the authorization lives in one place at the DB layer.
  const { error } = await supabase.rpc("update_member_role", {
    p_workspace_id: workspace_id,
    p_user_id: userId,
    p_role: role,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: statusFor(error.message) });

  return NextResponse.json({ success: true });
}

/** Remove a member from a workspace. Admin-only; the last admin cannot be removed. */
export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId } = await params;
  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  const { error } = await supabase.rpc("remove_member", {
    p_workspace_id: workspaceId,
    p_user_id: userId,
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: statusFor(error.message) });

  return NextResponse.json({ success: true });
}

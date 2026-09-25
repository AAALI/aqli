import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revokeInvitation } from "@/lib/supabase/invitations";
import { recordAudit, humanActor } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // The `invitations` RLS policy restricts updates to workspace admins, so a
  // non-admin (or non-member) revoke silently affects zero rows.
  // Read first (admins only, by the same policy) so the log can name it.
  const { data: inv } = await supabase
    .from("invitations")
    .select("workspace_id, email, role, status")
    .eq("id", id)
    .maybeSingle();
  await revokeInvitation(id);
  if (inv && inv.status === "pending") {
    await recordAudit({
      workspaceId: inv.workspace_id as string,
      actor: humanActor(user),
      action: "invitation.revoked",
      target: { type: "invitation", id, label: inv.email as string },
      metadata: { role: inv.role },
    });
  }
  return NextResponse.json({ success: true });
}

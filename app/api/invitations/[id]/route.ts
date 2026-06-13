import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revokeInvitation } from "@/lib/supabase/invitations";

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
  await revokeInvitation(id);
  return NextResponse.json({ success: true });
}

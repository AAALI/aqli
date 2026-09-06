import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc, updateDoc } from "@/lib/supabase/docs";
import { logActivity } from "@/lib/supabase/activity";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await getDoc(id);

  // Status stays as-is (typically approved); only the freshness clock resets.
  await updateDoc(id, { last_reviewed_at: new Date().toISOString() });

  await logActivity({
    docId: id,
    workspaceId: doc.workspace_id,
    actorType: "human",
    actorId: user.id,
    actorName:
      (user.user_metadata?.full_name as string | undefined) ??
      user.email ??
      user.id,
    action: "reviewed",
  });

  return NextResponse.json({ success: true });
}

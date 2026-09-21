import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc } from "@/lib/supabase/docs";
import { logActivity } from "@/lib/supabase/activity";

type Params = { params: Promise<{ id: string }> };

/**
 * Nudge the people a doc is waiting on (v3 §3.3).
 *
 * Recorded as a fresh `review_requested` in the activity log, which is what
 * the notification feed and the workspace webhooks already listen for — so a
 * nudge reaches people the same way the original ask did, and adds nothing to
 * the doc's review trail, which stays a record of decisions rather than of
 * reminders.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status !== "review") {
    return NextResponse.json({ error: "Nobody is being waited on" }, { status: 409 });
  }

  await logActivity({
    docId: id,
    workspaceId: doc.workspace_id,
    actorType: "human",
    actorId: user.id,
    actorName: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? user.id,
    action: "review_requested",
    metadata: { nudge: true },
  });

  return NextResponse.json({ success: true });
}

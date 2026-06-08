import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { approveDoc, rejectDoc, requestChanges } from "@/lib/supabase/review";
import { getDoc } from "@/lib/supabase/docs";
import { embedDoc } from "@/lib/ai/embedder";
import { logActivity } from "@/lib/supabase/activity";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, reason, note, workspace_id } = await req.json();

  if (!workspace_id)
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );

  const reviewerName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    user.id;

  if (action === "approve") {
    await approveDoc(id, user.id, reviewerName, workspace_id);

    // Re-embed now that the doc is approved — agents can find it in context
    // queries immediately. Fire-and-forget; log `embedded` once it lands.
    getDoc(id)
      .then((doc) =>
        embedDoc(doc).then(() =>
          logActivity({
            docId: id,
            workspaceId: workspace_id,
            actorType: "human",
            actorId: user.id,
            actorName: reviewerName,
            action: "embedded",
          }),
        ),
      )
      .catch((err) => console.error("Re-embed after approve failed:", err));

    return NextResponse.json({ status: "approved" });
  }

  if (action === "reject") {
    await rejectDoc(id, user.id, reviewerName, workspace_id, reason ?? "No reason given");
    return NextResponse.json({ status: "rejected" });
  }

  if (action === "request_changes") {
    await requestChanges(id, user.id, reviewerName, workspace_id, note ?? "");
    return NextResponse.json({ status: "changes_requested" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

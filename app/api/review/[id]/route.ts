import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { approveDoc, rejectDoc, requestChanges } from "@/lib/supabase/review";
import { getMyRole } from "@/lib/supabase/members";
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
  const { action, reason, note } = await req.json();

  // The review mutations below run on the service-role client, so the doc and
  // the caller's rights must be established here first. Fetching the doc via
  // the RLS client both proves it exists and that the caller can see it, and
  // gives us the authoritative workspace_id (never trust one from the body).
  const doc = await getDoc(id).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getMyRole(doc.workspace_id);
  if (role !== "admin" && role !== "editor")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const workspaceId = doc.workspace_id;
  const reviewerName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    user.id;

  if (action === "approve") {
    await approveDoc(id, user.id, reviewerName, workspaceId);

    // Re-embed now that the doc is approved — agents can find it in context
    // queries immediately. Fire-and-forget; log `embedded` once it lands.
    getDoc(id)
      .then((doc) =>
        embedDoc(doc).then(() =>
          logActivity({
            docId: id,
            workspaceId,
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
    await rejectDoc(id, user.id, reviewerName, workspaceId, reason ?? "No reason given");
    return NextResponse.json({ status: "rejected" });
  }

  if (action === "request_changes") {
    await requestChanges(id, user.id, reviewerName, workspaceId, note ?? "");
    return NextResponse.json({ status: "changes_requested" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

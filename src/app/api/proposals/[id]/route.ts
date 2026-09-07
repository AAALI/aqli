import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { approveProposal, rejectProposalWithNote } from "@/lib/supabase/review";
import { MergeError } from "@/lib/db";
import { embedDoc } from "@/lib/ai/embedder";
import { getDoc } from "@/lib/supabase/docs";
import { logActivity } from "@/lib/supabase/activity";

type Params = { params: Promise<{ id: string }> };

/**
 * Act on a proposal: approve (merge it) or reject it.
 *
 * The proposal is read through the RLS client first. That both proves it
 * exists and that the caller can see it, and gives the authoritative
 * workspace_id — which is never taken from the request body.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, note } = await req.json();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, workspace_id, document_id, state, space_id")
    .eq("id", id)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workspaceId = proposal.workspace_id as string;
  const role = await getMyRole(workspaceId);
  if (role !== "admin" && role !== "editor")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Named reviewers (docs/adoption.md F-4). A space that names none behaves as it
  // always has — any editor or admin may act — so turning this on is a
  // deliberate act rather than something that silently locks a team out of its
  // own queue. A space that names some is answered only by them.
  const spaceId = (proposal.space_id as string | null) ?? null;
  if (spaceId) {
    const { data: named } = await supabase.rpc("space_names_reviewers", { p_space_id: spaceId });
    if (named === true) {
      const { data: isReviewer } = await supabase.rpc("is_space_reviewer", {
        p_space_id: spaceId,
        p_user_id: user.id,
      });
      if (isReviewer !== true) {
        return NextResponse.json(
          {
            error: "not_a_reviewer",
            message: "This space names its own reviewers, and you are not one of them.",
          },
          { status: 403 },
        );
      }
    }
  }

  if (proposal.state !== "open") {
    return NextResponse.json(
      { error: "proposal_not_open", state: proposal.state },
      { status: 409 },
    );
  }

  const reviewerName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? user.id;

  if (action === "approve") {
    let documentId: string;
    try {
      documentId = await approveProposal(workspaceId, id, user.id, reviewerName);
    } catch (err) {
      // `stale_base` is the interesting one: the document moved while this sat
      // in the queue, so approving it would silently revert the newer change.
      // The author has to rebase; say so rather than failing opaquely.
      if (err instanceof MergeError) {
        return NextResponse.json({ error: err.code }, { status: err.status });
      }
      throw err;
    }

    // Re-embed now that the change is live — agents can find it in context
    // queries immediately. Fire-and-forget; log `embedded` once it lands.
    getDoc(documentId)
      .then((doc) =>
        embedDoc(doc).then(() =>
          logActivity({
            docId: documentId,
            workspaceId,
            actorType: "human",
            actorId: user.id,
            actorName: reviewerName,
            action: "embedded",
          }),
        ),
      )
      .catch((err) => console.error("Re-embed after approve failed:", err));

    return NextResponse.json({ status: "approved", document_id: documentId });
  }

  if (action === "reject") {
    try {
      await rejectProposalWithNote(
        workspaceId,
        id,
        user.id,
        reviewerName,
        note ?? "No reason given",
        (proposal.document_id as string | null) ?? null,
      );
    } catch (err) {
      if (err instanceof MergeError) {
        return NextResponse.json({ error: err.code }, { status: err.status });
      }
      throw err;
    }
    return NextResponse.json({ status: "rejected" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

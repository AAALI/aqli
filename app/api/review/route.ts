import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getPendingReviewDocs,
  getReviewCount,
  getOpenProposals,
  getOpenProposalCount,
} from "@/lib/supabase/review";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );

  // Two queues during the transition: open proposals, and the documents the
  // pre-proposals flow parked at `status = 'review'`. Nothing creates the
  // latter any more, but they are still waiting on a person.
  const [proposals, docs, proposalCount, docCount] = await Promise.all([
    getOpenProposals(workspaceId),
    getPendingReviewDocs(workspaceId),
    getOpenProposalCount(workspaceId),
    getReviewCount(workspaceId),
  ]);

  return NextResponse.json({
    proposals,
    docs,
    count: proposalCount + docCount,
  });
}

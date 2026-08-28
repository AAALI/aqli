import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../../../_auth";
import { getAgentWorkspaceMeta } from "../../../_workspace";
import { getAgentDoc, setAgentDocStatus } from "@/lib/supabase/agent-docs";
import { logActivity } from "@/lib/supabase/activity";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await getAgentDoc(agent.workspaceId, id, agent.ownerUserId);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Since step 5, an agent gets human review by having its proposal queued —
  // which the space policy and the key's scopes decide, not the agent. This
  // endpoint remains for agents that already call it: it flags the document
  // for attention, and the review queue lists it alongside open proposals.
  await setAgentDocStatus(agent.workspaceId, id, "review");

  await logActivity({
    docId: id,
    workspaceId: doc.workspace_id,
    actorType: "agent",
    actorId: doc.agent_id,
    actorName: doc.agent_id,
    action: "review_requested",
    metadata: { from_status: doc.status, to_status: "review" },
  });

  // Notifications (email / Slack) are intentionally out of scope for Week 3.

  const workspace = await getAgentWorkspaceMeta(agent.workspaceId);
  return NextResponse.json({
    status: "review_requested",
    message: "Human review requested. Doc will not enter trusted context until approved.",
    review_url: workspace.docUrl(id),
  });
}

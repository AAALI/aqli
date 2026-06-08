import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../../../_auth";
import { getAgentDoc, setAgentDocStatus } from "@/lib/supabase/agent-docs";
import { logActivity } from "@/lib/supabase/activity";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await getAgentDoc(id);
  if (!doc || doc.workspace_id !== agent.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await setAgentDocStatus(id, "review");

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

  return NextResponse.json({
    status: "review_requested",
    message: "Human review requested. Doc will not enter trusted context until approved.",
    review_url: `${APP_URL}/docs/${id}`,
  });
}

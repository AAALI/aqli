import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../../../_auth";
import { getAgentDoc, setAgentDocStatus } from "@/lib/supabase/agent-docs";

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

  // TODO (Week 3): notify workspace admins by email / Slack.

  return NextResponse.json({
    status: "review_requested",
    message: "Human review requested. Doc will not enter trusted context until approved.",
    review_url: `${APP_URL}/docs/${id}`,
  });
}

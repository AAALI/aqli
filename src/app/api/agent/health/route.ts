import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../_auth";

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }
  return NextResponse.json({
    status: "ok",
    workspace_id: agent.workspaceId,
    version: "0.2.0",
  });
}

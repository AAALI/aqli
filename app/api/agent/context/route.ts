import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../_auth";
import { queryContext } from "@/lib/ai/context";

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) {
    return NextResponse.json({ error: "query parameter required" }, { status: 400 });
  }

  const results = await queryContext(agent.workspaceId, query, {
    limit: Number(searchParams.get("limit") ?? 5),
    spaceSlug: searchParams.get("space") ?? undefined,
    docType: searchParams.get("type") ?? undefined,
    status: searchParams.get("status") ?? "approved",
  });

  return NextResponse.json({ query, results, total: results.length });
}

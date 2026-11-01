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

  try {
    const results = await queryContext(agent.workspaceId, query, {
      limit: Number(searchParams.get("limit") ?? 5),
      spaceSlug: searchParams.get("space") ?? undefined,
      docType: searchParams.get("type") ?? undefined,
      status: searchParams.get("status") ?? "approved",
      // The agent inherits the visibility of whoever owns the key.
      viewerId: agent.ownerUserId,
    });
    return NextResponse.json({ query, results, total: results.length });
  } catch (err) {
    // Embedding the query needs the model provider. An agent can act on a 503
    // (fall back to /api/agent/docs, retry later); a bare 500 tells it nothing.
    console.error("Agent context retrieval failed:", err);
    return NextResponse.json({ error: "Context retrieval is unavailable right now" }, { status: 503 });
  }
}

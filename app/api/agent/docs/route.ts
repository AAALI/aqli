import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../_auth";
import { listAgentDocs, createAgentDoc, getServiceSpaceBySlug } from "@/lib/supabase/agent-docs";
import { embedDoc } from "@/lib/ai/embedder";
import type { DocType, DocStatus } from "@/types/doc";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  const docs = await listAgentDocs(agent.workspaceId, {
    type: (searchParams.get("type") as DocType) ?? undefined,
    status: (searchParams.get("status") as DocStatus) ?? undefined,
    limit,
    offset,
  });

  return NextResponse.json({
    docs: docs.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      status: d.status,
      space: d.space?.slug ?? null,
      tags: d.frontmatter?.tags ?? [],
      author_type: d.author_type,
      updated_at: d.updated_at,
      url: `${APP_URL}/docs/${d.id}`,
    })),
    total: docs.length,
    has_more: docs.length === limit,
  });
}

export async function POST(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, type, space, tags, body_md, agent_id } = body;
  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // Resolve space slug → id (scoped to this agent's workspace).
  let spaceId: string | null = null;
  let spaceName = "Unknown";
  if (space) {
    const rec = await getServiceSpaceBySlug(agent.workspaceId, space);
    if (rec) {
      spaceId = rec.id;
      spaceName = rec.name;
    }
  }

  const doc = await createAgentDoc({
    workspace_id: agent.workspaceId,
    space_id: spaceId,
    title,
    type: type ?? "general",
    body_md,
    agent_id: agent_id ?? "unknown",
    frontmatter: { tags: tags ?? [] },
  });

  if (doc.body_md) {
    await embedDoc(doc, spaceName);
  }

  return NextResponse.json(
    {
      id: doc.id,
      title: doc.title,
      status: doc.status,
      author_type: doc.author_type,
      review_url: `${APP_URL}/docs/${doc.id}`,
      message: "Doc created with status 'draft'. Flag it for human review when ready.",
    },
    { status: 201 },
  );
}

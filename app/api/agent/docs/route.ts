import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../_auth";
import { getAgentWorkspaceMeta } from "../_workspace";
import { listAgentDocs, createAgentDoc, getServiceSpaceBySlug } from "@/lib/supabase/agent-docs";
import { embedDoc } from "@/lib/ai/embedder";
import { logActivity } from "@/lib/supabase/activity";
import type { DocType, DocStatus } from "@/types/doc";

function readPageParam(value: string | null, fallback: number, max: number) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 0), max);
}

export async function GET(req: NextRequest) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.max(readPageParam(searchParams.get("limit"), 20, 100), 1);
  const offset = readPageParam(searchParams.get("offset"), 0, Number.MAX_SAFE_INTEGER);

  const [{ docs, total }, workspace] = await Promise.all([
    listAgentDocs(agent.workspaceId, {
      type: (searchParams.get("type") as DocType) ?? undefined,
      status: (searchParams.get("status") as DocStatus) ?? undefined,
      limit,
      offset,
    }),
    getAgentWorkspaceMeta(agent.workspaceId),
  ]);

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
      url: workspace.docUrl(d.id),
    })),
    total,
    has_more: offset + docs.length < total,
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

  const workspace = await getAgentWorkspaceMeta(agent.workspaceId);

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

  // Workspace policy decides whether agent docs publish immediately or enter
  // the review queue (the default — humans approve before agents' output
  // becomes trusted context, per the PRD's review loop).
  const autoApprove = workspace.agentAutoApprove;
  const doc = await createAgentDoc({
    workspace_id: agent.workspaceId,
    space_id: spaceId,
    title,
    type: type ?? "general",
    body_md,
    agent_id: agent_id ?? "unknown",
    frontmatter: { tags: tags ?? [] },
    status: autoApprove ? "approved" : "review",
    markReviewed: autoApprove,
  });

  await logActivity({
    docId: doc.id,
    workspaceId: doc.workspace_id,
    actorType: "agent",
    actorId: doc.agent_id,
    actorName: doc.agent_id,
    action: "created",
    metadata: autoApprove
      ? { auto_approved: true, reason: "workspace_policy", to_status: "approved" }
      : { to_status: "review" },
  });

  // Embedding failures must not fail the request — the doc already exists,
  // and a 500 here makes well-behaved agents retry and create duplicates.
  if (doc.body_md) {
    await embedDoc(doc, spaceName).catch((err) =>
      console.error("Embed failed for agent doc", doc.id, err),
    );
  }

  return NextResponse.json(
    {
      id: doc.id,
      title: doc.title,
      status: doc.status,
      author_type: doc.author_type,
      url: workspace.docUrl(doc.id),
      message: autoApprove
        ? "Doc created and auto-approved — it is now trusted, searchable context."
        : "Doc created and queued for human review. It will not enter trusted context until approved.",
    },
    { status: 201 },
  );
}

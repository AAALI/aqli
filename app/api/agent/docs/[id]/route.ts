import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../../_auth";
import { getAgentWorkspaceMeta } from "../../_workspace";
import { getAgentDoc, proposeAgentDoc } from "@/lib/supabase/agent-docs";
import { embedDoc } from "@/lib/ai/embedder";
import { MergeError } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Scoped to the key's workspace, so a document from another workspace comes
  // back as null rather than as a row this route has to remember to reject.
  const doc = await getAgentDoc(agent.workspaceId, id, agent.ownerUserId);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "markdown";
  if (format === "json") {
    return NextResponse.json({ doc });
  }

  const frontmatter = [
    "---",
    `id: ${doc.id}`,
    `title: ${doc.title}`,
    `type: ${doc.type}`,
    `status: ${doc.status}`,
    `author_type: ${doc.author_type}`,
    doc.agent_id ? `agent_id: ${doc.agent_id}` : null,
    `space: ${doc.space?.slug ?? ""}`,
    `tags: [${(doc.frontmatter?.tags ?? []).join(", ")}]`,
    doc.frontmatter?.linked_project_url ? `linked_project_url: ${doc.frontmatter.linked_project_url}` : null,
    `updated_at: ${doc.updated_at}`,
    doc.current_revision_id ? `revision: ${doc.current_revision_id}` : null,
    doc.last_reviewed_at ? `last_reviewed_at: ${doc.last_reviewed_at}` : null,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const workspace = await getAgentWorkspaceMeta(agent.workspaceId);
  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    status: doc.status,
    frontmatter: doc.frontmatter,
    body_md: `${frontmatter}\n\n${doc.body_md ?? ""}`,
    url: workspace.docUrl(doc.id),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getAgentDoc(agent.workspaceId, id, agent.ownerUserId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates = await req.json();
  if (typeof updates.body_md !== "string") {
    return NextResponse.json({ error: "body_md is required" }, { status: 400 });
  }

  const workspace = await getAgentWorkspaceMeta(agent.workspaceId);

  let result;
  try {
    result = await proposeAgentDoc({
      workspaceId: agent.workspaceId,
      agentKeyId: agent.keyId,
      documentId: id,
      // Optimistic concurrency is opt-in. An agent that sends the revision it
      // read gets a 409 if the document moved; one that does not gets
      // last-writer-wins, which is what this endpoint has always done.
      baseRevisionId:
        typeof updates.base_revision_id === "string" ? updates.base_revision_id : null,
      title: typeof updates.title === "string" ? updates.title : existing.title,
      bodyMd: updates.body_md,
      frontmatter: updates.frontmatter
        ? { ...existing.frontmatter, ...updates.frontmatter }
        : existing.frontmatter,
      rationale: typeof updates.rationale === "string" ? updates.rationale : null,
      idempotencyKey:
        typeof updates.idempotency_key === "string" ? updates.idempotency_key : null,
      trusted: workspace.agentAutoApprove,
    });
  } catch (err) {
    if (err instanceof MergeError) {
      // `stale_base` carries the revision the agent needs to re-read from —
      // that is the whole point of returning 409 rather than just failing.
      return NextResponse.json(
        {
          error: err.code,
          ...(err.code === "stale_base"
            ? { current_revision_id: existing.current_revision_id }
            : {}),
        },
        { status: err.status },
      );
    }
    throw err;
  }

  if (!result.doc) {
    return NextResponse.json(
      {
        proposal_id: result.proposalId,
        state: result.state,
        message:
          "Change submitted for human review. The document is unchanged until it is approved.",
      },
      { status: 202 },
    );
  }

  // Embedding failures must not fail the update — the write already landed.
  await embedDoc(result.doc, existing.space?.name).catch((err) =>
    console.error("Embed failed for agent doc", result.doc?.id, err),
  );

  return NextResponse.json({
    id: result.doc.id,
    updated_at: result.doc.updated_at,
    proposal_id: result.proposalId,
    revision_id: result.doc.current_revision_id,
  });
}

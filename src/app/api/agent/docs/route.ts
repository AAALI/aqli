import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../_auth";
import { getAgentWorkspaceMeta } from "../_workspace";
import { listAgentDocs, proposeAgentDoc, getServiceSpaceBySlug } from "@/lib/supabase/agent-docs";
import { embedDoc } from "@/lib/ai/embedder";
import { logActivity } from "@/lib/supabase/activity";
import { MergeError } from "@/lib/db";
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
      // `parent_id=root` lists the top level; a uuid lists that page's
      // sub-pages. Absent, the listing is flat, as it was before sub-pages.
      parentId: (searchParams.get("parent_id") as string | "root") ?? undefined,
      viewerId: agent.ownerUserId,
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
      parent_id: d.parent_doc_id ?? null,
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
  const { title, type, space, tags, body_md, agent_id, parent_id } = body;
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

  // Every agent write is a proposal. Whether it lands immediately or waits for
  // a person is the merge engine's decision, from the space's review policy
  // and this key's scopes — not something this route gets to choose.
  const autoApprove = workspace.agentAutoApprove;

  let result;
  try {
    result = await proposeAgentDoc({
      workspaceId: agent.workspaceId,
      agentKeyId: agent.keyId,
      spaceId,
      // The database validates the parent and inherits its space, so an
      // importer replaying a tree does not have to resolve both.
      parentId: typeof parent_id === "string" ? parent_id : null,
      title,
      bodyMd: body_md ?? "",
      type: type ?? "general",
      status: autoApprove ? "approved" : "draft",
      agentId: agent_id ?? "unknown",
      frontmatter: { tags: tags ?? [] },
      rationale: typeof body.rationale === "string" ? body.rationale : null,
      // Agents retry. An idempotency key means a retry replays the first
      // outcome instead of creating a second document.
      idempotencyKey: typeof body.idempotency_key === "string" ? body.idempotency_key : null,
      trusted: autoApprove,
      markReviewed: autoApprove,
    });
  } catch (err) {
    if (err instanceof MergeError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  // Queued: no document exists yet, so there is nothing to embed, nothing to
  // link to, and nothing to log activity against.
  if (!result.doc) {
    return NextResponse.json(
      {
        proposal_id: result.proposalId,
        state: result.state,
        message:
          "Change submitted for human review. No document exists until it is approved.",
      },
      { status: 202 },
    );
  }

  const doc = result.doc;
  await logActivity({
    docId: doc.id,
    workspaceId: doc.workspace_id,
    actorType: "agent",
    actorId: doc.agent_id,
    actorName: doc.agent_id,
    action: "created",
    metadata: {
      proposal_id: result.proposalId,
      ...(autoApprove
        ? { auto_approved: true, reason: "workspace_policy", to_status: doc.status }
        : { to_status: doc.status }),
    },
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
      proposal_id: result.proposalId,
      revision_id: doc.current_revision_id,
      url: workspace.docUrl(doc.id),
      message: result.replayed
        ? "Already created by an earlier request with this idempotency key."
        : "Doc created and merged — it is now trusted, searchable context.",
    },
    { status: result.replayed ? 200 : 201 },
  );
}

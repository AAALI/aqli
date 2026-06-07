import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "../../_auth";
import { getAgentDoc, updateAgentDoc } from "@/lib/supabase/agent-docs";
import { embedDoc } from "@/lib/ai/embedder";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await getAgentDoc(id);
  if (!doc || doc.workspace_id !== agent.workspaceId) {
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
    doc.last_reviewed_at ? `last_reviewed_at: ${doc.last_reviewed_at}` : null,
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    status: doc.status,
    frontmatter: doc.frontmatter,
    body_md: `${frontmatter}\n\n${doc.body_md ?? ""}`,
    url: `${APP_URL}/docs/${doc.id}`,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const agent = await authenticateAgent(req);
  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await getAgentDoc(id);
  if (!existing || existing.workspace_id !== agent.workspaceId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates = await req.json();
  const updated = await updateAgentDoc(id, {
    body_md: updates.body_md,
    frontmatter: updates.frontmatter
      ? { ...existing.frontmatter, ...updates.frontmatter }
      : undefined,
  });

  if (typeof updates.body_md === "string") {
    await embedDoc(updated, existing.space?.name);
  }

  return NextResponse.json({ id: updated.id, updated_at: updated.updated_at });
}

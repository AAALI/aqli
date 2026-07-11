import { createServiceClient } from "@/lib/supabase/server";
import { markdownToTiptap } from "@/lib/markdown/md-to-tiptap";
import type { Doc, DocType, DocStatus, DocFrontmatter } from "@/types/doc";

/**
 * Service-role doc operations for the agent API. Agents authenticate with an
 * API key (no Supabase session), so these bypass RLS and scope every query to
 * the key's workspace_id explicitly.
 */

export async function getServiceSpaceBySlug(workspaceId: string, slug: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("spaces")
    .select("id, name, slug")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function listAgentDocs(
  workspaceId: string,
  opts: { type?: DocType; status?: DocStatus; limit: number; offset: number },
) {
  const supabase = createServiceClient();
  let q = supabase
    .from("docs")
    .select("*, space:spaces(slug, name)", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);
  if (opts.type) q = q.eq("type", opts.type);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error, count } = await q;
  if (error) throw error;
  return {
    docs: (data ?? []) as (Doc & { space: { slug: string; name: string } | null })[],
    total: count ?? 0,
  };
}

export async function getAgentDoc(id: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("docs")
    .select("*, space:spaces(slug, name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as (Doc & { space: { slug: string; name: string } | null }) | null;
}

export async function snapshotAgentDocVersion(
  docId: string,
  bodyMd: string,
  frontmatter: DocFrontmatter | null,
  changeType: "edit" | "status_change" | "created",
) {
  const supabase = createServiceClient();
  const { data: prev } = await supabase
    .from("doc_versions")
    .select("version_number")
    .eq("doc_id", docId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = (prev?.version_number ?? 0) + 1;
  await supabase.from("doc_versions").insert({
    doc_id: docId,
    version_number: next,
    body_md: bodyMd,
    frontmatter,
    change_type: changeType,
  });
}

export async function createAgentDoc(payload: {
  workspace_id: string;
  space_id?: string | null;
  title: string;
  type?: DocType;
  body_md?: string;
  agent_id?: string;
  frontmatter?: DocFrontmatter;
  /**
   * Initial doc status. Defaults to `draft`. Callers that already have a
   * trusted source (e.g. a merged PR) can pass `approved` directly to avoid
   * a second `setAgentDocStatus` call that would otherwise produce a
   * redundant `status_change` version snapshot.
   */
  status?: DocStatus;
  /** Marks `last_reviewed_at` at creation time. Useful with `status: 'approved'`. */
  markReviewed?: boolean;
}): Promise<Doc> {
  const supabase = createServiceClient();
  const bodyMd = payload.body_md ?? "";
  const { data, error } = await supabase
    .from("docs")
    .insert({
      workspace_id: payload.workspace_id,
      space_id: payload.space_id ?? null,
      title: payload.title,
      type: payload.type ?? "general",
      status: payload.status ?? "draft",
      author_type: "agent",
      agent_id: payload.agent_id ?? "unknown",
      body_md: bodyMd,
      body_json: bodyMd ? markdownToTiptap(bodyMd) : { type: "doc", content: [{ type: "paragraph" }] },
      frontmatter: payload.frontmatter ?? { tags: [] },
      ...(payload.markReviewed ? { last_reviewed_at: new Date().toISOString() } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  const doc = data as Doc;
  if (doc.body_md) await snapshotAgentDocVersion(doc.id, doc.body_md, doc.frontmatter, "created");
  return doc;
}

export async function updateAgentDoc(
  id: string,
  updates: { body_md?: string; frontmatter?: DocFrontmatter },
): Promise<Doc> {
  const supabase = createServiceClient();
  const current = await getAgentDoc(id);
  const patch: Record<string, unknown> = {};
  if (typeof updates.body_md === "string") {
    patch.body_md = updates.body_md;
    patch.body_json = markdownToTiptap(updates.body_md);
  }
  if (updates.frontmatter) patch.frontmatter = updates.frontmatter;
  const { data, error } = await supabase.from("docs").update(patch).eq("id", id).select().single();
  if (error) throw error;
  if (typeof updates.body_md === "string" && current?.body_md !== updates.body_md) {
    await snapshotAgentDocVersion(id, updates.body_md, updates.frontmatter ?? current?.frontmatter ?? null, "edit");
  }
  return data as Doc;
}

export async function setAgentDocStatus(
  id: string,
  status: DocStatus,
  opts?: { markReviewed?: boolean },
): Promise<Doc> {
  const supabase = createServiceClient();
  const { data: current } = await supabase.from("docs").select("status, body_md, frontmatter").eq("id", id).single();
  if (current && current.status !== status && current.body_md) {
    await snapshotAgentDocVersion(id, current.body_md, current.frontmatter as DocFrontmatter | null, "status_change");
  }
  const patch: Record<string, unknown> = { status };
  // Merge-driven updates are already trusted (the PR was reviewed in GitHub),
  // so they go straight to approved and reset the freshness clock.
  if (opts?.markReviewed) patch.last_reviewed_at = new Date().toISOString();
  const { data, error } = await supabase.from("docs").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Doc;
}

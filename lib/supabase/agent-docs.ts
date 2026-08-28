import { scoped, submitProposal, type SubmitResult } from "@/lib/db";
import { markdownToTiptap } from "@/lib/markdown/md-to-tiptap";
import type { Doc, DocType, DocStatus, DocFrontmatter } from "@/types/doc";

/**
 * Document access for the agent API (spec §2.4, §3).
 *
 * Agents authenticate with a bearer key rather than a Supabase session, so RLS
 * does not apply and these run on the service role. Every one of them goes
 * through `scoped(workspaceId)`, which appends the workspace predicate itself
 * — the cross-workspace check is structural rather than a `!==` repeated in
 * each route.
 *
 * Writes do not touch `docs`. They go through `submitProposal`, so an agent's
 * change is subject to the space's review policy and its key's scopes, and
 * lands as a revision with the key recorded against it. That closes the
 * trust-boundary bug by construction: there is no code path left where an
 * agent edits a document directly.
 */

export async function getServiceSpaceBySlug(workspaceId: string, slug: string) {
  const { data } = await scoped(workspaceId)
    .from("spaces")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  return data as { id: string; name: string; slug: string } | null;
}

export async function listAgentDocs(
  workspaceId: string,
  opts: {
    type?: DocType;
    status?: DocStatus;
    limit: number;
    offset: number;
    /** A document id to list the children of, or "root" for top-level documents. */
    parentId?: string | "root";
  },
) {
  let q = scoped(workspaceId)
    .from("docs")
    .select("*, space:spaces(slug, name)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);
  if (opts.type) q = q.eq("type", opts.type);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.parentId === "root") q = q.is("parent_doc_id", null);
  else if (opts.parentId) q = q.eq("parent_doc_id", opts.parentId);
  const { data, error, count } = await q;
  if (error) throw error;
  return {
    docs: (data ?? []) as unknown as (Doc & {
      space: { slug: string; name: string } | null;
    })[],
    total: count ?? 0,
  };
}

export type AgentDoc = Doc & { space: { slug: string; name: string } | null };

/**
 * How many sub-pages a document has.
 *
 * A count rather than the children themselves: `read_doc` returning a nested
 * tree would put an unbounded amount of text in front of a model that asked
 * for one document. Knowing there are six is enough to decide whether to call
 * `list_docs` for them.
 */
export async function countChildDocs(workspaceId: string, docId: string): Promise<number> {
  const { count, error } = await scoped(workspaceId)
    .from("docs")
    .select("id", { count: "exact", head: true })
    .eq("parent_doc_id", docId);
  if (error) throw error;
  return count ?? 0;
}

export async function getAgentDoc(
  workspaceId: string,
  id: string,
): Promise<AgentDoc | null> {
  const { data, error } = await scoped(workspaceId)
    .from("docs")
    .select("*, space:spaces(slug, name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as AgentDoc) ?? null;
}

export type AgentWrite = {
  workspaceId: string;
  /**
   * The key making the write, recorded on the proposal and on its revision.
   * Null for a `system` writer — the PR ingester and the importer hold no key
   * because no person issued them one.
   */
  agentKeyId?: string | null;
  /** Defaults to `agent`. `system` covers the PR ingester and the importer. */
  origin?: "agent" | "system";
  /** Null creates a document; a uuid revises one. */
  documentId?: string | null;
  spaceId?: string | null;
  /**
   * The revision the agent read. Pass it and a concurrent change raises
   * `stale_base`, which the API returns as 409 with the current revision so
   * the agent can re-read and re-propose. That is the rebase.
   */
  baseRevisionId?: string | null;
  title: string;
  bodyMd: string;
  type?: DocType;
  status?: DocStatus;
  /** Place a new document under this one. Ignored when revising: a move is not an edit. */
  parentId?: string | null;
  /**
   * Where an imported document came from — `{ source, id }`. Unique per
   * workspace (20260812000000), which is what makes a re-run of an import
   * update rather than duplicate.
   */
  sourceRef?: { source: string; id: string } | null;
  agentId?: string;
  frontmatter?: DocFrontmatter;
  rationale?: string | null;
  idempotencyKey?: string | null;
  /**
   * The workspace's `agent_auto_approve` setting. It predates per-key scopes;
   * passing it grants the `write` scope for this one decision, so a
   * `review_all` space still queues.
   */
  trusted?: boolean;
  /** Resets the staleness clock. Only for writes from an already-reviewed source. */
  markReviewed?: boolean;
};

export type AgentWriteResult = SubmitResult & {
  /** Null when the write queued and the document does not exist yet. */
  doc: AgentDoc | null;
};

/**
 * The single agent write path. Create and update are the same operation, told
 * apart only by whether `documentId` is set — this replaces `createAgentDoc`
 * and `updateAgentDoc`.
 */
export async function proposeAgentDoc(input: AgentWrite): Promise<AgentWriteResult> {
  const bodyMd = input.bodyMd ?? "";
  const result = await submitProposal({
    workspaceId: input.workspaceId,
    documentId: input.documentId ?? null,
    baseRevisionId: input.baseRevisionId ?? null,
    spaceId: input.spaceId ?? null,
    title: input.title,
    bodyMd,
    // Transitional: the editor still renders `body_json`, so an agent write
    // has to keep it in step or the next person to open the document sees the
    // previous version. Step 6 retires this.
    bodyJson: bodyMd
      ? (markdownToTiptap(bodyMd) as Record<string, unknown>)
      : { type: "doc", content: [{ type: "paragraph" }] },
    frontmatter: {
      ...(input.frontmatter ?? { tags: [] }),
      // With no key to infer it from, the actor type has to be stated.
      ...(input.origin === "system" ? { origin: "system" as const } : {}),
      // Control keys are only read when a proposal creates a document, so
      // there is no point sending them on a revision — and sending them would
      // imply an agent could change a document's type or status by editing it.
      ...(input.documentId
        ? {}
        : {
            doc_type: input.type ?? "general",
            doc_status: input.status ?? "draft",
            agent_id: input.agentId ?? "unknown",
            // Placement travels with creation, like type and status. The
            // database reads this key, validates the parent, and inherits its
            // space (20260811000000). Absent when revising: re-parenting an
            // existing document is a move, and a move is not a proposal.
            ...(input.parentId ? { doc_parent_id: input.parentId } : {}),
            ...(input.sourceRef ? { doc_source_ref: input.sourceRef } : {}),
          }),
    },
    rationale: input.rationale ?? null,
    agentKeyId: input.agentKeyId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    trusted: input.trusted ?? false,
    markReviewed: input.markReviewed ?? false,
  });

  const doc = result.documentId
    ? await getAgentDoc(input.workspaceId, result.documentId)
    : null;
  return { ...result, doc };
}

/**
 * Status is document metadata, not content: it is not what a reviewer
 * approves, and `proposals` does not model it. It keeps taking the direct
 * path.
 */
export async function setAgentDocStatus(
  workspaceId: string,
  id: string,
  status: DocStatus,
  opts?: { markReviewed?: boolean },
): Promise<Doc> {
  const patch: Record<string, unknown> = { status };
  // Merge-driven updates are already trusted (the PR was reviewed in GitHub),
  // so they go straight to approved and reset the freshness clock.
  if (opts?.markReviewed) patch.last_reviewed_at = new Date().toISOString();
  const { data, error } = await scoped(workspaceId)
    .from("docs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Doc;
}

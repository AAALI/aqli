import { createServerSupabaseClient } from "./server";
import { submitProposal, type SubmitResult } from "@/lib/db/proposals";
import { mergeEngineEnabled } from "@/lib/flags";
import type {
  Doc,
  DocType,
  DocStatus,
  DocFrontmatter,
  DocVersion,
  DocWithSpace,
} from "@/types/doc";

const DOC_SELECT = "*, space:spaces(id, workspace_id, name, slug, icon, created_at)";

export async function getDocs(
  workspaceId: string,
  options?: {
    spaceId?: string;
    type?: DocType;
    status?: DocStatus;
    limit?: number;
    offset?: number;
  },
) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("docs")
    .select(DOC_SELECT)
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (options?.spaceId) query = query.eq("space_id", options.spaceId);
  if (options?.type) query = query.eq("type", options.type);
  if (options?.status) query = query.eq("status", options.status);
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset !== undefined) {
    query = query.range(
      options.offset,
      options.offset + (options.limit ?? 20) - 1,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DocWithSpace[];
}

export async function getDoc(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("docs")
    .select(DOC_SELECT)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as DocWithSpace;
}

/**
 * What a save did. `proposal` is null on the direct-write path (the merge
 * engine flag is off); when it is set, `doc` is null for a queued write
 * because the document does not exist until a reviewer merges it.
 */
export type SaveResult = {
  doc: Doc | null;
  proposal: SubmitResult | null;
};

export async function createDoc(payload: {
  workspace_id: string;
  space_id?: string | null;
  title?: string;
  type?: DocType;
  owner_id?: string;
  body_json?: Record<string, unknown>;
  body_md?: string;
  frontmatter?: DocFrontmatter;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("docs")
    .insert({
      ...payload,
      title: payload.title ?? "Untitled",
      type: payload.type ?? "general",
      status: "draft",
      author_type: "human",
      frontmatter: payload.frontmatter ?? { tags: [] },
    })
    .select()
    .single();
  if (error) throw error;

  const doc = data as Doc;
  if (doc.body_md) {
    await snapshotVersion(
      doc.id,
      doc.body_md,
      doc.frontmatter,
      "created",
      doc.owner_id ?? undefined,
    );
  }
  return doc;
}

/**
 * Fields the merge engine owns. Everything else on a document — its status,
 * owner, type, space — is metadata that `proposals` does not model and that a
 * reviewer is not being asked to approve, so it keeps taking the direct path.
 */
const CONTENT_FIELDS = ["title", "body_md", "body_json", "frontmatter"] as const;
type ContentField = (typeof CONTENT_FIELDS)[number];

type DocUpdates = Partial<
  Pick<
    Doc,
    | "title"
    | "type"
    | "status"
    | "owner_id"
    | "body_json"
    | "body_md"
    | "frontmatter"
    | "space_id"
    | "last_reviewed_at"
  >
>;

function hasContentChange(updates: DocUpdates): boolean {
  return CONTENT_FIELDS.some((f) => f in updates && updates[f as ContentField] !== undefined);
}

/**
 * Create a document (spec §3).
 *
 * With the merge engine on this is a proposal like any other write, which is
 * what gives a brand new document a revision 1 instead of a row that appeared
 * from nowhere. In a `review_all` space it queues, and no document exists
 * until a reviewer merges it — hence the null `doc`.
 */
export async function createDocument(
  payload: Parameters<typeof createDoc>[0],
): Promise<SaveResult> {
  if (!mergeEngineEnabled()) {
    return { doc: await createDoc(payload), proposal: null };
  }

  const supabase = await createServerSupabaseClient();
  const proposal = await submitProposal(
    {
      workspaceId: payload.workspace_id,
      spaceId: payload.space_id ?? null,
      title: payload.title ?? "Untitled",
      bodyMd: payload.body_md ?? "",
      bodyJson: payload.body_json ?? null,
      frontmatter: {
        ...(payload.frontmatter ?? { tags: [] }),
        doc_type: payload.type ?? "general",
        doc_status: "draft",
      },
      authorId: payload.owner_id ?? null,
    },
    supabase,
  );

  const doc = proposal.documentId ? await getDoc(proposal.documentId) : null;
  return { doc, proposal };
}

/**
 * Save an edit (spec §3).
 *
 * Content goes through `propose → merge` when the flag is on; metadata is
 * applied directly either way. A queued content change leaves the document
 * exactly as it was — the caller has to say so rather than reporting "saved".
 */
export async function saveDoc(id: string, updates: DocUpdates): Promise<SaveResult> {
  if (!mergeEngineEnabled() || !hasContentChange(updates)) {
    return { doc: await updateDoc(id, updates), proposal: null };
  }

  const current = await getDoc(id);
  const supabase = await createServerSupabaseClient();

  const proposal = await submitProposal(
    {
      workspaceId: current.workspace_id,
      spaceId: updates.space_id ?? current.space_id,
      documentId: id,
      title: updates.title ?? current.title,
      bodyMd: updates.body_md ?? current.body_md ?? "",
      bodyJson: (updates.body_json ?? current.body_json) as Record<string, unknown> | null,
      frontmatter: updates.frontmatter ?? current.frontmatter,
      // No base revision: the editor has always been last-writer-wins, and a
      // 2-second autosave that 409s on every concurrent keystroke would be
      // worse than the conflict it prevents. Agents pass a base and get real
      // optimistic concurrency.
    },
    supabase,
  );

  // Metadata the merge engine does not carry. Applied after the merge so a
  // refused merge does not leave a half-applied save behind.
  const metadata = Object.fromEntries(
    Object.entries(updates).filter(
      ([k]) => !CONTENT_FIELDS.includes(k as ContentField),
    ),
  ) as DocUpdates;

  const doc = Object.keys(metadata).length > 0
    ? await updateDoc(id, metadata)
    : ((await getDoc(id)) as Doc);

  return { doc, proposal };
}

export async function updateDoc(
  id: string,
  updates: Partial<
    Pick<
      Doc,
      | "title"
      | "type"
      | "status"
      | "owner_id"
      | "body_json"
      | "body_md"
      | "frontmatter"
      | "space_id"
      | "last_reviewed_at"
    >
  >,
) {
  const supabase = await createServerSupabaseClient();

  // Snapshot a version when status changes.
  if (updates.status) {
    const current = await getDoc(id);
    if (current.status !== updates.status && current.body_md) {
      await snapshotVersion(
        id,
        current.body_md,
        current.frontmatter,
        "status_change",
        current.owner_id ?? undefined,
      );
    }
  }

  const { data, error } = await supabase
    .from("docs")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Doc;
}

export async function deleteDoc(id: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("docs").delete().eq("id", id);
  if (error) throw error;
}

/**
 * A revision, shaped for the history UI.
 *
 * `revisions` is the history from step 6 on. It was backfilled from
 * `doc_versions` in step 3, so it is a superset — nothing is lost by reading
 * it instead, and everything written since the merge engine landed is only
 * here. `doc_versions` recorded content edits only on status changes; a
 * revision is written for every merged change, by anyone.
 */
export type DocRevision = {
  id: string;
  version_number: number;
  change_type: string;
  created_at: string;
  body_md: string;
  title: string;
  author_id: string | null;
  agent_key_id: string | null;
  proposal_id: string | null;
};

export async function getDocVersions(docId: string): Promise<DocRevision[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("revisions")
    .select("id, seq, title, body_md, author_id, agent_key_id, proposal_id, created_at")
    .eq("document_id", docId)
    .order("seq", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as {
    id: string;
    seq: number;
    title: string;
    body_md: string;
    author_id: string | null;
    agent_key_id: string | null;
    proposal_id: string | null;
    created_at: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    version_number: r.seq,
    // `revisions` records who wrote a change, not what kind of change it was —
    // which is the more useful thing to show anyway.
    change_type:
      r.seq === 1 ? "created" : r.agent_key_id ? "agent_edit" : "edit",
    created_at: r.created_at,
    body_md: r.body_md ?? "",
    title: r.title,
    author_id: r.author_id,
    agent_key_id: r.agent_key_id,
    proposal_id: r.proposal_id,
  }));
}

/**
 * Legacy `doc_versions` rows, for auditing the step-3 backfill. Nothing in the
 * app reads these since step 6.
 */
export async function getLegacyDocVersions(docId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("doc_versions")
    .select("*")
    .eq("doc_id", docId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocVersion[];
}

export async function snapshotVersion(
  docId: string,
  bodyMd: string,
  frontmatter: DocFrontmatter | null,
  changeType: "edit" | "status_change" | "created",
  changedBy?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { data: versions } = await supabase
    .from("doc_versions")
    .select("version_number")
    .eq("doc_id", docId)
    .order("version_number", { ascending: false })
    .limit(1);

  const nextVersion = (versions?.[0]?.version_number ?? 0) + 1;

  const { error } = await supabase.from("doc_versions").insert({
    doc_id: docId,
    version_number: nextVersion,
    body_md: bodyMd,
    frontmatter,
    changed_by: changedBy ?? null,
    change_type: changeType,
  });
  // Best-effort: don't block the doc update if versioning fails, but never
  // swallow the error silently (this previously hid an RLS denial).
  if (error) console.error("snapshotVersion failed:", error.message);
}

export type Backlink = {
  id: string;
  title: string;
  type: DocType;
  status: DocStatus;
  space: { name: string; slug: string } | null;
};

/**
 * Docs that link to this one — the "Cited by" backlinks in the viewer.
 * Internal citations are stored in `body_md` as links whose target contains
 * `/docs/<id>` (see the editor's cite/quote inserts), so a substring match on
 * the rendered markdown is enough to find them.
 */
export async function getBacklinks(docId: string, workspaceId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("docs")
    .select("id, title, type, status, space:spaces(name, slug)")
    .eq("workspace_id", workspaceId)
    .neq("id", docId)
    .ilike("body_md", `%/docs/${docId}%`)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as Backlink[];
}

export async function searchDocs(workspaceId: string, query: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("docs")
    .select("id, title, type, status, space_id, updated_at, body_md")
    .eq("workspace_id", workspaceId)
    .textSearch("search_vector", query, { type: "websearch" })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

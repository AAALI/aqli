import { createServerSupabaseClient } from "./server";
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

export async function getDocVersions(docId: string) {
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

import { createServerSupabaseClient, createServiceClient } from "./server";
import { logActivity } from "./activity";
import type { DocWithSpace } from "@/types/doc";

const REVIEW_SELECT = "*, space:spaces(id, workspace_id, name, slug, icon, created_at)";

/** Docs awaiting human review, oldest first — the queue works FIFO. */
export async function getPendingReviewDocs(
  workspaceId: string,
): Promise<DocWithSpace[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("docs")
    .select(REVIEW_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("status", "review")
    .order("updated_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DocWithSpace[];
}

export async function getReviewCount(workspaceId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("docs")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "review");
  if (error) throw error;
  return count ?? 0;
}

export async function approveDoc(
  docId: string,
  reviewerId: string,
  reviewerName: string,
  workspaceId: string,
): Promise<void> {
  const supabase = createServiceClient();
  // Callers must have verified the reviewer's membership; the workspace_id
  // predicate makes a doc-id/workspace mismatch a no-op rather than a
  // cross-tenant write.
  await supabase
    .from("docs")
    .update({ status: "approved", last_reviewed_at: new Date().toISOString() })
    .eq("id", docId)
    .eq("workspace_id", workspaceId);

  await logActivity({
    docId,
    workspaceId,
    actorType: "human",
    actorId: reviewerId,
    actorName: reviewerName,
    action: "approved",
    metadata: { from_status: "review", to_status: "approved" },
  });
}

export async function rejectDoc(
  docId: string,
  reviewerId: string,
  reviewerName: string,
  workspaceId: string,
  reason: string,
): Promise<void> {
  const supabase = createServiceClient();
  // Rejected docs return to draft — the agent can revise and re-request review.
  await supabase
    .from("docs")
    .update({ status: "draft" })
    .eq("id", docId)
    .eq("workspace_id", workspaceId);

  await supabase.from("doc_comments").insert({
    doc_id: docId,
    workspace_id: workspaceId,
    author_id: reviewerId,
    body: reason,
    comment_type: "rejection",
  });

  await logActivity({
    docId,
    workspaceId,
    actorType: "human",
    actorId: reviewerId,
    actorName: reviewerName,
    action: "rejected",
    metadata: { reason, from_status: "review", to_status: "draft" },
  });
}

export async function requestChanges(
  docId: string,
  reviewerId: string,
  reviewerName: string,
  workspaceId: string,
  note: string,
): Promise<void> {
  const supabase = createServiceClient();
  // Status stays 'review' — it stays in the queue but with a note attached.
  await supabase.from("doc_comments").insert({
    doc_id: docId,
    workspace_id: workspaceId,
    author_id: reviewerId,
    body: note,
    comment_type: "change_request",
  });

  await logActivity({
    docId,
    workspaceId,
    actorType: "human",
    actorId: reviewerId,
    actorName: reviewerName,
    action: "changes_requested",
    metadata: { note },
  });
}

/** Comments on a doc, newest first (review feedback trail). */
export async function getDocComments(docId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("doc_comments")
    .select("*")
    .eq("doc_id", docId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

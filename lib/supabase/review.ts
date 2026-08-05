import { createServerSupabaseClient } from "./server";
import { scoped, mergeProposal, rejectProposal } from "@/lib/db";
import { logActivity } from "./activity";
import type { DocWithSpace } from "@/types/doc";
import type { ProposalWithContext } from "@/types/proposal";

const REVIEW_SELECT = "*, space:spaces(id, workspace_id, name, slug, icon, created_at)";

const PROPOSAL_SELECT = [
  "*",
  "space:spaces(id, name, slug, icon)",
  "document:docs(id, title, body_md, type, status, current_revision_id)",
  "agent_key:api_keys(id, name)",
].join(", ");

/**
 * Open proposals, oldest first — the queue works FIFO.
 *
 * Read through the RLS client: `proposals_read` already restricts this to
 * workspaces the caller is a member of, so there is nothing here for a service
 * client to do.
 */
export async function getOpenProposals(
  workspaceId: string,
): Promise<ProposalWithContext[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("proposals")
    .select(PROPOSAL_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("state", "open")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ProposalWithContext[];
}

export async function getOpenProposalCount(workspaceId: string): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("proposals")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("state", "open");
  if (error) throw error;
  return count ?? 0;
}

/**
 * Approve a proposal: merge it, and reset the document's staleness clock the
 * way `approveDoc` always has.
 *
 * Runs on the workspace-scoped service client. The caller has already proved
 * the reviewer's membership and role; `app.merge_proposal` re-checks it
 * whenever there is a session to check.
 */
export async function approveProposal(
  workspaceId: string,
  proposalId: string,
  reviewerId: string,
  reviewerName: string,
): Promise<string> {
  const documentId = await mergeProposal(workspaceId, proposalId, {
    actorId: reviewerId,
    markReviewed: true,
  });

  await logActivity({
    docId: documentId,
    workspaceId,
    actorType: "human",
    actorId: reviewerId,
    actorName: reviewerName,
    action: "approved",
    metadata: { proposal_id: proposalId },
  });

  return documentId;
}

export async function rejectProposalWithNote(
  workspaceId: string,
  proposalId: string,
  reviewerId: string,
  reviewerName: string,
  note: string,
  documentId: string | null,
): Promise<void> {
  await rejectProposal(workspaceId, proposalId, { actorId: reviewerId, note });

  // A proposal that would have created a document has no document to log
  // against — `doc_activity.doc_id` is NOT NULL — and there is nothing for a
  // reader to click through to either.
  if (documentId) {
    await logActivity({
      docId: documentId,
      workspaceId,
      actorType: "human",
      actorId: reviewerId,
      actorName: reviewerName,
      action: "rejected",
      metadata: { proposal_id: proposalId, reason: note },
    });
  }
}

/**
 * Docs parked at `status = 'review'` by the pre-proposals flow.
 *
 * Kept alongside the proposal queue rather than dropped: these are real
 * documents waiting on a real person, and hiding them the day the queue moved
 * to `proposals` would strand them silently. Nothing creates new ones.
 */
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
  // Callers must have verified the reviewer's membership; the scoped client's
  // workspace predicate makes a doc-id/workspace mismatch a no-op rather than a
  // cross-tenant write.
  await scoped(workspaceId)
    .from("docs")
    .update({ status: "approved", last_reviewed_at: new Date().toISOString() })
    .eq("id", docId);

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
  const supabase = scoped(workspaceId);
  // Rejected docs return to draft — the agent can revise and re-request review.
  await supabase.from("docs").update({ status: "draft" }).eq("id", docId);

  await supabase.from("doc_comments").insert({
    doc_id: docId,
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
  // Status stays 'review' — it stays in the queue but with a note attached.
  await scoped(workspaceId).from("doc_comments").insert({
    doc_id: docId,
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
export async function getDocComments(workspaceId: string, docId: string) {
  const { data, error } = await scoped(workspaceId)
    .from("doc_comments")
    .select("*")
    .eq("doc_id", docId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

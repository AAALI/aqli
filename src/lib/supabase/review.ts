import { createServerSupabaseClient } from "./server";
import { mergeProposal, rejectProposal } from "@/lib/db";
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
 * to `proposals` would strand them silently. Publishing with checkers
 * named creates them now: that is how "waiting on Sara" is stored.
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




// The reader for these rows lives in `lib/supabase/comments.ts` now, where the
// review trail and ordinary comments are one thread. It reads through RLS
// rather than the service client, which is possible since `doc_comments`
// gained policies in 20260808000000.

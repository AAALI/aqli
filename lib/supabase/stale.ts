import { createServerSupabaseClient } from "./server";
import { scoped } from "@/lib/db";
import type { Doc, DocWithSpace } from "@/types/doc";

export const DEFAULT_STALE_DAYS = 90;

function cutoffISO(staleDays: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);
  return cutoff.toISOString();
}

/**
 * Approved docs that haven't been reviewed within the freshness window.
 * Only approved docs go stale — drafts are expected to be incomplete.
 *
 * Records are excluded. `app.merge_proposal` sets `last_reviewed_at` only when
 * `doc_class = 'canon'`, so a record's review date is null for its whole life:
 * including them here puts every deploy log and meeting note permanently in the
 * queue, and re-verifying a dated record is not a thing anyone does anyway.
 */
export async function getStaleDocs(
  workspaceId: string,
  staleDays = DEFAULT_STALE_DAYS,
): Promise<DocWithSpace[]> {
  const supabase = await createServerSupabaseClient();
  const cutoff = cutoffISO(staleDays);

  const { data, error } = await supabase
    .from("docs")
    .select("*, space:spaces(id, workspace_id, name, slug, icon, created_at)")
    .eq("workspace_id", workspaceId)
    .eq("status", "approved")
    .eq("doc_class", "canon")
    .or(`last_reviewed_at.is.null,last_reviewed_at.lt.${cutoff}`)
    .order("last_reviewed_at", { ascending: true, nullsFirst: true });

  if (error) throw error;
  return (data ?? []) as DocWithSpace[];
}

export async function getStaleCount(
  workspaceId: string,
  staleDays = DEFAULT_STALE_DAYS,
): Promise<number> {
  const cutoff = cutoffISO(staleDays);

  const { count, error } = await scoped(workspaceId)
    .from("docs")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved")
    .eq("doc_class", "canon")
    .or(`last_reviewed_at.is.null,last_reviewed_at.lt.${cutoff}`);

  if (error) throw error;
  return count ?? 0;
}

export function daysSinceReview(doc: Pick<Doc, "last_reviewed_at">): number | null {
  if (!doc.last_reviewed_at) return null;
  const reviewed = new Date(doc.last_reviewed_at);
  const now = new Date();
  return Math.floor((now.getTime() - reviewed.getTime()) / (1000 * 60 * 60 * 24));
}

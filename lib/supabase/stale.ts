import { createServerSupabaseClient } from "./server";
import { scoped } from "@/lib/db";
import {
  CADENCE_DAYS,
  cadenceOf,
  isDocOverdue,
  type Verifiable,
  type VerifyCadence,
} from "@/lib/verify-cadence";
import type { Doc, DocWithSpace } from "@/types/doc";

/**
 * The freshness window for a doc that has not chosen one. Kept for the label
 * on the "Needs updating" screen; the actual test is per-doc (see below).
 */
export const DEFAULT_STALE_DAYS = CADENCE_DAYS.quarterly;

/**
 * The shortest cadence any doc can be on. Used as the SQL prefilter: a doc
 * verified more recently than this cannot be overdue under *any* cadence, so
 * the database can discard it before the per-doc test runs.
 */
const SHORTEST_CADENCE_DAYS = Math.min(...Object.values(CADENCE_DAYS));

function cutoffISO(staleDays: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - staleDays);
  return cutoff.toISOString();
}

/**
 * Approved docs that are overdue for verification **under their own cadence**.
 *
 * Freshness used to be one global 90-day rule, but a doc now carries a
 * `verify_cadence` (see `lib/verify-cadence.ts`) and the viewer's trust line
 * reads it. Those two have to agree: without this, a doc set to yearly could
 * show a green "Verified" line to its reader while simultaneously sitting in
 * "Needs updating" and on the home page's attention list. A doc explicitly set
 * to no schedule never appears here at all.
 *
 * The cadence lives in a jsonb column, so the filtering is split: SQL narrows
 * to everything that *could* be overdue, then each row is tested against the
 * cadence it actually carries.
 *
 * Only approved docs go stale — drafts are expected to be incomplete.
 *
 * Records are excluded. `app.merge_proposal` sets `last_reviewed_at` only when
 * `doc_class = 'canon'`, so a record's review date is null for its whole life:
 * including them here puts every deploy log and meeting note permanently in the
 * queue, and re-verifying a dated record is not a thing anyone does anyway.
 */
export async function getStaleDocs(workspaceId: string): Promise<DocWithSpace[]> {
  const supabase = await createServerSupabaseClient();
  const cutoff = cutoffISO(SHORTEST_CADENCE_DAYS);

  const { data, error } = await supabase
    .from("docs")
    .select("*, space:spaces(id, workspace_id, name, slug, icon, created_at)")
    .eq("workspace_id", workspaceId)
    .eq("status", "approved")
    .eq("doc_class", "canon")
    .or(`last_reviewed_at.is.null,last_reviewed_at.lt.${cutoff}`)
    .order("last_reviewed_at", { ascending: true, nullsFirst: true });

  if (error) throw error;
  return ((data ?? []) as DocWithSpace[]).filter(isDocOverdue);
}

export async function getStaleCount(workspaceId: string): Promise<number> {
  const cutoff = cutoffISO(SHORTEST_CADENCE_DAYS);

  // Not a `head: true` count any more: the cadence is inside `frontmatter`, so
  // the rows have to come back to be tested. The prefilter keeps that set to
  // docs unverified for at least the shortest cadence.
  const { data, error } = await scoped(workspaceId)
    .from("docs")
    .select("last_reviewed_at, frontmatter")
    .eq("status", "approved")
    .eq("doc_class", "canon")
    .or(`last_reviewed_at.is.null,last_reviewed_at.lt.${cutoff}`);

  if (error) throw error;
  return ((data ?? []) as Verifiable[]).filter(isDocOverdue).length;
}

/** The cadence a doc is held to, for display alongside its overdue count. */
export function cadenceFor(doc: { frontmatter: Doc["frontmatter"] | null }): VerifyCadence {
  return cadenceOf(doc.frontmatter?.verify_cadence);
}

export function daysSinceReview(doc: Pick<Doc, "last_reviewed_at">): number | null {
  if (!doc.last_reviewed_at) return null;
  const reviewed = new Date(doc.last_reviewed_at);
  const now = new Date();
  return Math.floor((now.getTime() - reviewed.getTime()) / (1000 * 60 * 60 * 24));
}

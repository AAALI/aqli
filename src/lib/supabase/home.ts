import { createServerSupabaseClient } from "./server";
import { getBacklinks } from "./docs";
import { getOwnerDirectory } from "./owners";
import { getGaps, type Gap } from "./questions";
import { docState } from "@/lib/doc-status";
import { startOfWeek } from "@/lib/home";
import type { DocWithSpace } from "@/types/doc";

const DOC_SELECT = "*, space:spaces(id, workspace_id, name, slug, icon, created_at)";

export type WaitingItem =
  | { kind: "asked"; doc: DocWithSpace; askedBy: string | null; askedAt: string }
  | { kind: "ageing"; doc: DocWithSpace; citedBy: number };

export type HomeData = {
  /** Your most recent draft, if you have one in flight. */
  leftOff: DocWithSpace | null;
  draftCount: number;
  waiting: WaitingItem[];
  checksTotal: number;
  newSince: DocWithSpace[];
  gaps: Gap[];
  /** Whether anything at all has been published — false means first run. */
  hasPublished: boolean;
};

/**
 * Everything Home shows (v3 §5.7): what should I read, write, or check today.
 *
 * Each section explains *why you are seeing it*: someone asked you, you own
 * it and it is ageing, it is new since Monday, people keep asking and nothing
 * answers them. No counters, no stats row, no feed of everything.
 */
export async function getHome(workspaceId: string, userId: string | null): Promise<HomeData> {
  const supabase = await createServerSupabaseClient();
  const monday = startOfWeek(new Date()).toISOString();

  const [drafts, review, mine, recent, published, gaps] = await Promise.all([
    userId
      ? supabase
          .from("docs")
          .select(DOC_SELECT)
          .eq("workspace_id", workspaceId)
          .eq("status", "draft")
          .eq("owner_id", userId)
          .order("updated_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    supabase
      .from("docs")
      .select(DOC_SELECT)
      .eq("workspace_id", workspaceId)
      .eq("status", "review")
      .order("updated_at", { ascending: true })
      .limit(50),
    userId
      ? supabase
          .from("docs")
          .select(DOC_SELECT)
          .eq("workspace_id", workspaceId)
          .eq("owner_id", userId)
          .not("last_reviewed_at", "is", null)
          .in("status", ["approved", "stale"])
          .order("last_reviewed_at", { ascending: true })
          .limit(50)
      : Promise.resolve({ data: [] }),
    supabase
      .from("docs")
      .select(DOC_SELECT)
      .eq("workspace_id", workspaceId)
      .neq("status", "draft")
      .neq("status", "archived")
      .gte("created_at", monday)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("docs")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .neq("status", "draft"),
    getGaps(workspaceId, { sinceDays: 7, limit: 3 }),
  ]);

  const myDrafts = (drafts.data ?? []) as DocWithSpace[];
  const reviewDocs = (review.data ?? []) as DocWithSpace[];

  // Which of the waiting docs asked *you*: the people named in each doc's most
  // recent review request.
  const asked: WaitingItem[] = [];
  if (userId && reviewDocs.length) {
    const { data: asks } = await supabase
      .from("doc_comments")
      .select("doc_id, author_id, mentions, created_at")
      .eq("workspace_id", workspaceId)
      .eq("comment_type", "review_request")
      .in(
        "doc_id",
        reviewDocs.map((d) => d.id),
      )
      .order("created_at", { ascending: false });
    const latest = new Map<string, { author_id: string | null; mentions: string[]; created_at: string }>();
    for (const a of (asks ?? []) as { doc_id: string; author_id: string | null; mentions: string[]; created_at: string }[]) {
      if (!latest.has(a.doc_id)) latest.set(a.doc_id, a);
    }
    const askerIds = [...new Set([...latest.values()].map((a) => a.author_id).filter(Boolean))] as string[];
    const names = await memberNames(workspaceId, askerIds);
    for (const doc of reviewDocs) {
      const a = latest.get(doc.id);
      if (a?.mentions?.includes(userId)) {
        asked.push({
          kind: "asked",
          doc,
          askedBy: a.author_id ? (names[a.author_id] ?? null) : null,
          askedAt: a.created_at,
        });
      }
    }
  }

  // Docs you own that nobody has confirmed in a while. Their citation count
  // is the reason it matters.
  const ageingMine = ((mine.data ?? []) as DocWithSpace[]).filter((d) => docState(d) === "ageing").slice(0, 3);
  const ageing: WaitingItem[] = await Promise.all(
    ageingMine.map(async (doc) => ({
      kind: "ageing" as const,
      doc,
      citedBy: (await getBacklinks(doc.id, workspaceId).catch(() => [])).length,
    })),
  );

  return {
    leftOff: myDrafts[0] ?? null,
    draftCount: myDrafts.length,
    waiting: [...asked, ...ageing],
    checksTotal: reviewDocs.length,
    newSince: (recent.data ?? []) as DocWithSpace[],
    gaps,
    hasPublished: (published.count ?? 0) > 0,
  };
}

async function memberNames(workspaceId: string, ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const dir = await getOwnerDirectory(workspaceId).catch(() => ({}) as Record<string, { name: string }>);
  return Object.fromEntries(ids.filter((id) => dir[id]).map((id) => [id, dir[id].name]));
}

import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getPendingReviewDocs, getOpenProposals } from "@/lib/supabase/review";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppTopBar from "@/components/layout/AppTopBar";
import ChecksClient, { type CheckItem } from "./ChecksClient";
import { whatChanged, firstParagraph } from "@/lib/checks";

/**
 * Checks (v3 §5.9, frame 09). Was "Review Queue".
 *
 * A to-do list, not a tribunal: each item says who asked, why, and how long
 * it will take to read. There is no approve / reject / request-changes modal
 * set — you open the doc and either confirm it or edit it. Agent drafts land
 * here too, attributed to the agent; a person confirms every one.
 */
export default async function ChecksPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [proposals, docs, owners] = await Promise.all([
    getOpenProposals(workspace.id),
    getPendingReviewDocs(workspace.id),
    getOwnerDirectory(workspace.id),
  ]);

  // The latest ask on each waiting doc: who asked, and whom.
  const { data: asks } = docs.length
    ? await supabase
        .from("doc_comments")
        .select("doc_id, author_id, mentions, created_at")
        .eq("workspace_id", workspace.id)
        .eq("comment_type", "review_request")
        .in("doc_id", docs.map((d) => d.id))
        .order("created_at", { ascending: false })
    : { data: [] };
  const lastAsk = new Map<string, { author_id: string | null; mentions: string[]; created_at: string }>();
  for (const a of (asks ?? []) as { doc_id: string; author_id: string | null; mentions: string[]; created_at: string }[]) {
    if (!lastAsk.has(a.doc_id)) lastAsk.set(a.doc_id, a);
  }

  // The version before this one, for "what's different".
  const previous = new Map<string, { seq: number; body: string }>();
  await Promise.all(
    docs.map(async (d) => {
      const { data } = await supabase
        .from("revisions")
        .select("seq, body_md")
        .eq("document_id", d.id)
        .order("seq", { ascending: false })
        .range(1, 1);
      const row = (data ?? [])[0] as { seq: number; body_md: string } | undefined;
      if (row) previous.set(d.id, { seq: row.seq, body: row.body_md ?? "" });
    }),
  );

  const name = (id: string | null) => (id ? (owners[id]?.name ?? "A teammate") : "Someone");

  const items: CheckItem[] = [
    ...docs.map((d): CheckItem => {
      const ask = lastAsk.get(d.id);
      const prev = previous.get(d.id);
      const changes = prev ? whatChanged(prev.body, d.body_md ?? "") : [];
      return {
        kind: "doc",
        id: d.id,
        title: d.title || "Untitled",
        space: d.space?.name ?? null,
        minutes: readMinutes(d.body_md),
        askedAt: ask?.created_at ?? d.updated_at,
        asker: ask ? name(ask.author_id) : null,
        askedYou: Boolean(user && ask?.mentions?.includes(user.id)),
        others: (ask?.mentions ?? []).filter((m) => m !== user?.id).map((m) => name(m)),
        changes,
        changedFrom: prev ? prev.seq : null,
        excerpt: changes.length ? "" : firstParagraph(d.body_md),
      };
    }),
    ...proposals.map((p): CheckItem => ({
      kind: "agent",
      id: p.id,
      title: p.title || "Untitled",
      space: p.space?.name ?? null,
      minutes: readMinutes(p.body_md),
      askedAt: p.created_at,
      agent:
        p.agent_key?.name ??
        (p.frontmatter?.agent_id as string | undefined) ??
        (p.frontmatter?.origin === "system" ? "An integration" : name(p.author_id)),
      isAgent: Boolean(p.agent_key_id || p.frontmatter?.agent_id),
      excerpt: firstParagraph(p.body_md),
      changes: p.document ? whatChanged(p.document.body_md ?? "", p.body_md ?? "") : [],
      body: p.body_md ?? "",
    })),
  ];
  // Yours first, then the oldest ask — the one that has waited longest.
  items.sort((a, b) => {
    const ay = a.kind === "doc" && a.askedYou ? 0 : 1;
    const by = b.kind === "doc" && b.askedYou ? 0 : 1;
    return ay - by || (a.askedAt < b.askedAt ? -1 : 1);
  });

  return (
    <>
      <AppTopBar crumbs={[{ label: "Checks" }]} />
      <ChecksClient items={items} base={base} />
    </>
  );
}

function readMinutes(md: string | null): number {
  return Math.max(1, Math.round((md ?? "").split(/\s+/).filter(Boolean).length / 230));
}

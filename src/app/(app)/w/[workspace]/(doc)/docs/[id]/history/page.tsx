import { notFound } from "next/navigation";
import { getDoc, getDocVersions } from "@/lib/supabase/docs";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import { getDocActivity } from "@/lib/supabase/activity";
import { getMyRole } from "@/lib/supabase/members";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { versionLabel, versionProse } from "@/lib/history";
import HistoryClientLoader from "./HistoryClientLoader";

/**
 * Doc history (v3 §5.16, frame 16). Reached from the rail's History tab.
 * Versions on the left, the change itself on the right, each described in
 * prose: who changed it and whether anyone confirmed it after.
 */
export default async function DocHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const { v } = await searchParams;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();

  const supabase = await createServerSupabaseClient();
  const [versions, owners, activity, role] = await Promise.all([
    getDocVersions(id).catch(() => []),
    getOwnerDirectory(doc.workspace_id),
    getDocActivity(doc.workspace_id, doc.id, 200).catch(() => []),
    getMyRole(doc.workspace_id),
  ]);

  // The change's own rationale, where the proposal that made it gave one.
  const proposalIds = versions.map((r) => r.proposal_id).filter(Boolean) as string[];
  const { data: proposals } = proposalIds.length
    ? await supabase.from("proposals").select("id, rationale, agent_key:api_keys(name)").in("id", proposalIds)
    : { data: [] };
  const byProposal = new Map(
    ((proposals ?? []) as unknown as { id: string; rationale: string | null; agent_key: { name: string } | null }[]).map((p) => [p.id, p]),
  );
  const confirmations = activity
    .filter((a) => a.action === "reviewed" || a.action === "approved")
    .map((a) => ({ name: a.actor_name ?? "Someone", at: a.created_at }))
    .sort((a, b) => a.at.localeCompare(b.at));

  const total = versions.length;
  // Newest first. A version's confirmation is the first one after it and
  // before the next version replaced it.
  const views = versions.map((r, i) => {
    const older = versions[i + 1];
    const newer = versions[i - 1];
    const proposal = r.proposal_id ? byProposal.get(r.proposal_id) : undefined;
    const byAgent = Boolean(r.agent_key_id);
    const who = byAgent
      ? (proposal?.agent_key?.name ?? "An agent")
      : r.author_id
        ? (owners[r.author_id]?.name ?? "A teammate")
        : "An integration";
    const confirmedBy =
      confirmations.find((c) => c.at >= r.created_at && (!newer || c.at < newer.created_at)) ?? null;
    return {
      id: r.id,
      n: r.version_number,
      total,
      label: versionLabel({ n: r.version_number, rationale: proposal?.rationale ?? null, before: older?.body_md ?? null, after: r.body_md }),
      who,
      byAgent,
      at: r.created_at,
      prose: versionProse({ n: r.version_number, who, byAgent, at: r.created_at, confirmedBy }),
      body_md: r.body_md,
      before: older?.body_md ?? null,
    };
  });

  return (
    <HistoryClientLoader
      workspaceSlug={wsSlug}
      docId={doc.id}
      docTitle={doc.title}
      spaceName={doc.space?.name ?? null}
      spaceSlug={doc.space?.slug ?? null}
      versions={views}
      initial={v ?? null}
      canRestore={role === "admin" || role === "editor"}
    />
  );
}

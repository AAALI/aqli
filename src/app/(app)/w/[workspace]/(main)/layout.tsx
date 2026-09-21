import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces, getSpaceDocCounts } from "@/lib/supabase/spaces";
import { getReviewCount, getOpenProposalCount } from "@/lib/supabase/review";
import { getDocs } from "@/lib/supabase/docs";
import Sidebar from "@/components/layout/Sidebar";
import PhoneTabs from "@/components/layout/PhoneTabs";
import SchemaBehind from "@/components/preflight/SchemaBehind";
import { loadOrDrift } from "@/lib/preflight/drift";

export default async function MainShell({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug).catch(() => null);
  if (!workspace) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Checks counts everything waiting on a person: open proposals plus the
  // documents the pre-proposals flow left at `status = 'review'`.
  const counts = await loadOrDrift(() =>
    Promise.all([
      getSpaces(workspace.id),
      getOpenProposalCount(workspace.id),
      getReviewCount(workspace.id),
      getSpaceDocCounts(workspace.id),
      getDocs(workspace.id, { status: "draft", limit: 200 }),
    ]),
  );
  if (!counts.ok) {
    return <SchemaBehind drift={counts.drift} healthHref={`/w/${slug}/settings/health`} />;
  }
  const [spaces, proposalCount, legacyReviewCount, spaceCounts, drafts] = counts.data;
  const checksCount = proposalCount + legacyReviewCount;
  // Your drafts, not the workspace's: nobody can see these but you, so a count
  // of everyone's would be a number you cannot open.
  const draftsCount = user ? drafts.filter((d) => d.owner_id === user.id).length : 0;
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "You";

  return (
    <>
      <Sidebar
        workspaceSlug={workspace.slug}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        spaces={spaces}
        userName={userName}
        checksCount={checksCount}
        draftsCount={draftsCount}
        spaceCounts={spaceCounts}
      />
      <div className="main has-ptabs">{children}</div>
      <PhoneTabs
        base={`/w/${workspace.slug}`}
        writeHref={spaces[0] ? `/w/${workspace.slug}/write?space=${spaces[0].slug}` : `/w/${workspace.slug}/write`}
      />
    </>
  );
}

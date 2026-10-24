import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces, getSpaceDocCounts } from "@/lib/supabase/spaces";
import { getReviewCount, getOpenProposalCount } from "@/lib/supabase/review";
import { countMyDrafts } from "@/lib/supabase/docs";
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

  const user = await getUser();

  // Checks counts everything waiting on a person: open proposals plus the
  // documents the pre-proposals flow left at `status = 'review'`.
  const counts = await loadOrDrift(() =>
    Promise.all([
      getSpaces(workspace.id),
      getOpenProposalCount(workspace.id),
      getReviewCount(workspace.id),
      getSpaceDocCounts(workspace.id),
      // Your drafts, not the workspace's: nobody can see these but you, so a
      // count of everyone's would be a number you cannot open.
      user ? countMyDrafts(workspace.id, user.id) : Promise.resolve(0),
    ]),
  );
  if (!counts.ok) {
    return <SchemaBehind drift={counts.drift} healthHref={`/w/${slug}/settings/health`} />;
  }
  const [spaces, proposalCount, legacyReviewCount, spaceCounts, draftsCount] = counts.data;
  const checksCount = proposalCount + legacyReviewCount;
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

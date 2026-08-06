import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import { getReviewCount, getOpenProposalCount } from "@/lib/supabase/review";
import { getStaleCount } from "@/lib/supabase/stale";
import Sidebar from "@/components/layout/Sidebar";

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

  // The sidebar badge counts everything waiting on a person: open proposals
  // plus the documents the pre-proposals flow left at `status = 'review'`.
  const [spaces, proposalCount, legacyReviewCount, staleCount] = await Promise.all([
    getSpaces(workspace.id),
    getOpenProposalCount(workspace.id),
    getReviewCount(workspace.id),
    getStaleCount(workspace.id),
  ]);
  const reviewCount = proposalCount + legacyReviewCount;
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
        reviewCount={reviewCount}
        staleCount={staleCount}
      />
      <div className="main">{children}</div>
    </>
  );
}

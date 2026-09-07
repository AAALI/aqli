import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getPendingReviewDocs, getOpenProposals } from "@/lib/supabase/review";
import AppTopBar from "@/components/layout/AppTopBar";
import ReviewQueueClient from "./ReviewQueueClient";

export default async function ReviewQueuePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;
  const [proposals, docs] = await Promise.all([
    getOpenProposals(workspace.id),
    getPendingReviewDocs(workspace.id),
  ]);

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Review Queue" }]} />
      <ReviewQueueClient
        proposals={proposals}
        docs={docs}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
      />
    </>
  );
}

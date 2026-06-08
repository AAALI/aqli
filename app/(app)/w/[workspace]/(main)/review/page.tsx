import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getPendingReviewDocs } from "@/lib/supabase/review";
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
  const docs = await getPendingReviewDocs(workspace.id);

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Review Queue" }]} />
      <ReviewQueueClient
        docs={docs}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
      />
    </>
  );
}

import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import AppTopBar from "@/components/layout/AppTopBar";
import { getReviewDoc, AGENT_TRAIL, REVIEW_COMMENTS } from "@/lib/mock/reviews";
import ReviewDetailClient from "./ReviewDetailClient";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;
  const doc = getReviewDoc(id);
  if (!doc) notFound();

  const shortTitle = doc.title.length > 28 ? `${doc.title.slice(0, 28)}…` : doc.title;

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <AppTopBar
        base={base}
        crumbs={[{ label: "Review", href: `${base}/review` }, { label: shortTitle }]}
      />
      <ReviewDetailClient doc={doc} trail={AGENT_TRAIL} comments={REVIEW_COMMENTS} />
    </div>
  );
}

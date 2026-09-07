import { permanentRedirect } from "next/navigation";

/**
 * `/review` is retired (v3 §5.19). The job moved to Checks — same work, human
 * words, top-level instead of buried under a "Workflow" group.
 *
 * A redirect rather than a 404 because the old path is linked from
 * notification emails and webhooks already sent.
 */
export default async function RetiredReviewQueue({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  permanentRedirect(`/w/${workspace}/checks`);
}

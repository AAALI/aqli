import Link from "next/link";
import { notFound } from "next/navigation";
import { getDoc, getDocVersions, getBacklinks } from "@/lib/supabase/docs";
import { getOwnerDirectory, ownerInfo } from "@/lib/supabase/owners";
import { getDocCommentThread } from "@/lib/supabase/comments";
import { listWorkspaceMembers, getMyRole } from "@/lib/supabase/members";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppTopBar from "@/components/layout/AppTopBar";
import DownloadMarkdownButton from "@/components/docs/DownloadMarkdownButton";
import RequestReviewButton from "@/components/docs/RequestReviewButton";
import DocMetaRow from "@/components/docs/DocMetaRow";
import ProvenanceBar from "@/components/docs/ProvenanceBar";
import TrustLine from "@/components/docs/TrustLine";
import WhatChangedBanner from "@/components/docs/WhatChangedBanner";
import ReadingRail, { type DiscussionEntry } from "@/components/docs/ReadingRail";
import PrChangedBanner from "@/components/docs/PrChangedBanner";
import DocComments from "@/components/docs/DocComments";
import DocAskAssistant from "@/components/docs/DocAskAssistant";
import { getDocActivity } from "@/lib/supabase/activity";
import DocBodyClient from "@/components/docs/DocBodyClient";
import { IconEdit, IconHistory } from "@/components/aqli/icons";
import { isReviewTrail } from "@/types/comment";
import { toPlainText } from "@/lib/mentions";
import { cadenceOf, isDocOverdue } from "@/lib/verify-cadence";

type Loaded<T> = { data: T; failed: false } | { data: null; failed: true };

/**
 * Load something the page can render without.
 *
 * A comment thread that failed to load must not arrive as an empty one: to a
 * reader "no comments yet" and "we could not fetch the comments" look
 * identical, and only one of them is true. It also should not take the
 * document down with it — the doc body is why the reader is here. So the
 * failure travels to the section that can show it and offer a retry.
 */
async function loadSection<T>(work: Promise<T>, what: string): Promise<Loaded<T>> {
  try {
    return { data: await work, failed: false };
  } catch (err) {
    console.error(`doc page: could not load ${what}:`, err);
    return { data: null, failed: true };
  }
}

export default async function DocViewPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();

  const [versions, backlinks, owners, thread, members, role, activity, supabase] =
    await Promise.all([
      getDocVersions(id),
      getBacklinks(id, doc.workspace_id),
      getOwnerDirectory(doc.workspace_id),
      loadSection(getDocCommentThread(doc.workspace_id, id), "the comment thread"),
      loadSection(listWorkspaceMembers(doc.workspace_id), "the member list"),
      getMyRole(doc.workspace_id),
      getDocActivity(doc.workspace_id, doc.id, 50).catch(() => []),
      createServerSupabaseClient(),
    ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ownerName = doc.owner_id
    ? user?.id === doc.owner_id
      ? ((user.user_metadata?.full_name as string | undefined) ??
        owners[doc.owner_id]?.name ??
        "You")
      : (owners[doc.owner_id]?.name ?? "Team member")
    : null;

  const base = `/w/${wsSlug}`;
  const version = versions.length || 1;
  const prUrl = doc.frontmatter?.source_pr_url;
  // "Auto-approved" is a claim about status, not just origin — a PR-sourced
  // doc routed to review (auto-approve off) must not carry the chip.
  const isAutoApproved = Boolean(prUrl) && doc.status === "approved";
  const canEdit = role === "admin" || role === "editor";

  // Freshness is measured against the doc's own cadence, not one global 90-day
  // rule. `isDocOverdue` is the same predicate the "Needs updating" list uses,
  // so a doc cannot show a green trust line here and be flagged there.
  const cadence = cadenceOf(doc.frontmatter?.verify_cadence);
  const stale = isDocOverdue(doc);

  // Who last verified it. `last_reviewed_at` records when but not who, so the
  // name comes from the activity log, which does.
  const reviewerName =
    activity.find((a) => a.action === "reviewed")?.actor_name ?? null;

  // 08c: the doc's latest PR merge event powers the "What this PR changed"
  // banner. Only meaningful for PR-sourced docs.
  const prEvent = prUrl
    ? (activity.find((a) => a.metadata?.source === "github_pr") ?? null)
    : null;
  const historyHref = `${base}/docs/${doc.id}/history`;
  const spaceCrumb = doc.space
    ? { label: doc.space.name, href: `${base}/s/${doc.space.slug}` }
    : { label: "Home", href: base };

  const changes =
    versions.length > 1
      ? versions.slice(0, 3).map((v) => ({
          version_number: v.version_number,
          change_type: v.change_type,
          created_at: v.created_at,
        }))
      : [];

  // What the rail's Discussion block shows: real reader comments, newest
  // first, with the review trail left out — that is process, not conversation.
  const readerComments = (thread.data?.comments ?? []).filter(
    (c) => !isReviewTrail(c.comment_type),
  );
  const discussion: DiscussionEntry[] = readerComments
    .slice(-3)
    .reverse()
    .map((c) => ({
      id: c.id,
      author: c.author_name,
      excerpt: toPlainText(c.body, thread.data?.names ?? {}),
      createdAt: c.created_at,
    }));

  return (
    <>
      {/* One top bar. Type, status, owner and version used to be restated in a
          full-width strip beneath it; they now sit inline with the document. */}
      <AppTopBar
        base={base}
        crumbs={[spaceCrumb, { label: doc.title }]}
        share
        actions={
          <>
            <Link href={historyHref} className="btn btn-ghost" style={{ gap: 6 }}>
              <IconHistory size={13} />
              <span>History</span>
            </Link>
            <DownloadMarkdownButton doc={doc} />
            <Link
              href={`${base}/docs/${doc.id}/edit`}
              className="btn btn-secondary"
              style={{ gap: 6 }}
            >
              <IconEdit size={13} />
              <span>Edit</span>
            </Link>
            {doc.status === "draft" && <RequestReviewButton docId={doc.id} />}
          </>
        }
      />

      <div className="main-body" style={{ position: "relative" }}>
        <div id="doc-scroll" className="doc-scroll">
          <article id="doc-article" className="doc-col">
            <DocMetaRow doc={doc} version={version} autoApproved={isAutoApproved} />

            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontWeight: 400,
                fontSize: 44,
                lineHeight: 1.08,
                letterSpacing: "-0.018em",
              }}
            >
              {doc.title}
            </h1>

            <div style={{ marginTop: 14 }}>
              <ProvenanceBar doc={doc} ownerName={ownerName} />
            </div>

            <TrustLine
              docId={doc.id}
              lastReviewedAt={doc.last_reviewed_at}
              reviewerName={reviewerName}
              stale={stale}
              cadence={cadence}
              frontmatter={doc.frontmatter}
              canEdit={canEdit}
              prSource={
                isAutoApproved
                  ? {
                      repo: doc.frontmatter?.source_repo ?? null,
                      prNumber: prUrl?.match(/\/pull\/(\d+)/)?.[1] ?? null,
                    }
                  : null
              }
            />

            {prUrl && prEvent && (
              <PrChangedBanner
                prUrl={prUrl}
                repo={doc.frontmatter?.source_repo ?? null}
                filesChanged={
                  typeof prEvent.metadata?.files_changed === "number"
                    ? prEvent.metadata.files_changed
                    : null
                }
                eventAt={prEvent.created_at}
                created={prEvent.action === "created"}
              />
            )}

            <WhatChangedBanner
              docId={doc.id}
              currentVersion={version}
              historyHref={historyHref}
              changes={changes}
            />

            <div id="doc-body" style={{ marginTop: 32 }}>
              <DocBodyClient bodyMd={doc.body_md} title={doc.title} />
            </div>

            <div id="doc-comments">
              <DocComments
                docId={doc.id}
                initial={thread.data?.comments ?? []}
                names={thread.data?.names ?? {}}
                threadFailed={thread.failed}
                members={(members.data ?? []).map((m) => ({
                  user_id: m.user_id,
                  name: ownerInfo(m).name,
                  email: m.email,
                }))}
                membersFailed={members.failed}
                currentUserId={user?.id ?? null}
                canComment={canEdit}
                canModerate={role === "admin"}
              />
            </div>
          </article>
        </div>

        <ReadingRail
          base={base}
          backlinks={backlinks}
          discussion={discussion}
          discussionCount={readerComments.length}
          discussionFailed={thread.failed}
        />
      </div>

      {/* Reading's one floating affordance. The workspace-wide pill stands
          down on this route, so Ask never appears alongside Co-write. */}
      <DocAskAssistant
        workspaceId={doc.workspace_id}
        workspaceSlug={wsSlug}
        docId={doc.id}
        docTitle={doc.title}
      />
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getDoc, getDocVersions, getBacklinks } from "@/lib/supabase/docs";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppTopBar from "@/components/layout/AppTopBar";
import DownloadMarkdownButton from "@/components/docs/DownloadMarkdownButton";
import DocStatusControl from "@/components/docs/DocStatusControl";
import RequestReviewButton from "@/components/docs/RequestReviewButton";
import ProvenanceBar from "@/components/docs/ProvenanceBar";
import TrustLine from "@/components/docs/TrustLine";
import WhatChangedBanner from "@/components/docs/WhatChangedBanner";
import ReadingRail from "@/components/docs/ReadingRail";
import PrChangedBanner from "@/components/docs/PrChangedBanner";
import { getDocActivity } from "@/lib/supabase/activity";
import { AutoApprovedChip, TypeBadge } from "@/components/aqli/badges";
import DocBody from "@/components/docs/DocBody";
import { IconEdit, IconHistory } from "@/components/aqli/icons";
import { typeLabel } from "@/lib/doc-display";
import { isStale } from "@/lib/utils";

export default async function DocViewPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();

  const [versions, backlinks, owners, supabase] = await Promise.all([
    getDocVersions(id),
    getBacklinks(id, doc.workspace_id),
    getOwnerDirectory(doc.workspace_id),
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
  const stale = isStale(doc.last_reviewed_at);

  // 08c: the doc's latest PR merge event powers the "What this PR changed"
  // banner. Only fetched for PR-sourced docs.
  const prEvent = prUrl
    ? (await getDocActivity(doc.id, 25).catch(() => [])).find(
        (a) => a.metadata?.source === "github_pr",
      ) ?? null
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

  return (
    <>
      <AppTopBar base={base} crumbs={[spaceCrumb, { label: doc.title }]} share />

      {/* Slim action bar — actions only; type/status/version moved into the doc head */}
      <div
        style={{
          height: 44,
          flex: "0 0 44px",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 6,
          background: "var(--bg-base)",
        }}
      >
        <Link href={historyHref} className="btn btn-ghost" style={{ gap: 6 }}>
          <IconHistory size={13} />
          <span>History</span>
        </Link>
        <DownloadMarkdownButton doc={doc} />
        <Link href={`${base}/docs/${doc.id}/edit`} className="btn btn-secondary" style={{ gap: 6 }}>
          <IconEdit size={13} />
          <span>Edit</span>
        </Link>
        {doc.status === "draft" && <RequestReviewButton docId={doc.id} />}
      </div>

      <div className="main-body" style={{ position: "relative" }}>
        {/* Reading column */}
        <div
          id="doc-scroll"
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            background: "var(--bg-base)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <article
            id="doc-article"
            style={{
              width: "100%",
              maxWidth: 760,
              padding: "40px 56px 100px",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              lineHeight: 1.7,
            }}
          >
            {/* Head — type, status, version */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <TypeBadge type={typeLabel(doc.type)} />
              {isAutoApproved && <AutoApprovedChip />}
              <DocStatusControl docId={doc.id} status={doc.status} />
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                v{version}
                {doc.space ? ` · ${doc.space.name}` : ""}
              </span>
            </div>

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
              reviewerName={null}
              stale={stale}
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
              <DocBody content={doc.body_json} title={doc.title} />
            </div>
          </article>
        </div>

        <ReadingRail base={base} backlinks={backlinks} />
      </div>
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getDoc, getDocVersions } from "@/lib/supabase/docs";
import AppTopBar from "@/components/layout/AppTopBar";
import DownloadMarkdownButton from "@/components/docs/DownloadMarkdownButton";
import DocStatusControl from "@/components/docs/DocStatusControl";
import RequestReviewButton from "@/components/docs/RequestReviewButton";
import AqliEditor from "@/components/editor/AqliEditor";
import LinearPreviewPanel from "@/components/docs/LinearPreviewPanel";
import { IconEdit, IconHistory, IconSparkle } from "@/components/aqli/icons";
import { typeLabel } from "@/lib/doc-display";
import { formatRelative, formatDate } from "@/lib/utils";

export default async function DocViewPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();
  const versions = await getDocVersions(id);
  const base = `/w/${wsSlug}`;
  const version = versions.length || 1;
  const spaceCrumb = doc.space
    ? { label: doc.space.name, href: `${base}/s/${doc.space.slug}` }
    : { label: "Home", href: base };

  return (
    <>
      <AppTopBar base={base} crumbs={[spaceCrumb, { label: doc.title }]} share />

      {/* Status bar */}
      <div
        style={{
          height: 48,
          flex: "0 0 48px",
          borderBottom: "1px solid var(--border)",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "var(--bg-base)",
          fontSize: 13,
        }}
      >
        <DocStatusControl docId={doc.id} status={doc.status} />
        <span style={{ color: "var(--border-strong)" }}>|</span>
        <MetaItem label="Type">
          <span className="badge badge-type">{typeLabel(doc.type)}</span>
        </MetaItem>
        <MetaItem label="Last reviewed">
          <span style={{ color: "var(--text-primary)" }}>
            {doc.last_reviewed_at ? formatDate(doc.last_reviewed_at) : "Not yet reviewed"}
          </span>
        </MetaItem>
        <MetaItem label="Version">
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontSize: 12 }}>
            v{version}
          </span>
        </MetaItem>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href={`${base}/docs/${doc.id}/history`} className="btn btn-ghost" style={{ gap: 6 }}>
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
      </div>

      {/* Body + rail */}
      <div className="main-body">
        <div style={{ flex: 1, overflowY: "auto", padding: "56px 40px 48px", background: "var(--bg-base)" }}>
          <article
            style={{
              maxWidth: 720,
              margin: "0 auto",
              color: "var(--text-primary)",
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              lineHeight: 1.7,
            }}
          >
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 400,
                fontSize: 44,
                lineHeight: 1.1,
                letterSpacing: "-0.015em",
                margin: "0 0 12px",
              }}
            >
              {doc.title}
            </h1>
            <div style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 36 }}>
              v{version} · updated {formatRelative(doc.updated_at)}
            </div>
            <div className="prose prose-neutral max-w-none">
              <AqliEditor initialContent={doc.body_json} editable={false} />
            </div>
          </article>
        </div>

        <ViewerRail version={version} versions={versions} base={base} docId={doc.id} updated={doc.updated_at} linkedUrl={doc.frontmatter?.linked_project_url} />
      </div>
    </>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)" }}>
      <span style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{children}</span>
    </div>
  );
}

function ViewerRail({
  version,
  versions,
  base,
  docId,
  updated,
  linkedUrl,
}: {
  version: number;
  versions: { id: string; version_number: number; change_type: string; created_at: string }[];
  base: string;
  docId: string;
  updated: string;
  linkedUrl?: string;
}) {
  return (
    <aside style={{ width: 300, flex: "0 0 300px", background: "var(--bg-card)", borderLeft: "1px solid var(--border)", overflow: "auto" }}>
      {linkedUrl && <LinearPreviewPanel url={linkedUrl} />}
      <RailPanel title="AI summary" action={<span style={{ color: "var(--accent)", display: "flex" }}><IconSparkle size={13} /></span>}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>
          This doc is indexed for agent retrieval. An AI summary is generated from the latest
          approved version and refreshed as the doc changes.
        </p>
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-muted)" }}>
          Generated from v{version} · updated {formatRelative(updated)}
        </div>
      </RailPanel>

      <RailPanel
        title="Version history"
        action={
          <Link href={`${base}/docs/${docId}/history`} style={{ fontSize: 11.5, color: "var(--accent)", textDecoration: "none" }}>
            See all
          </Link>
        }
      >
        {versions.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No snapshots yet.</div>
        ) : (
          versions.slice(0, 4).map((v, i) => (
            <div key={v.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "8px 0", alignItems: "start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>
                  {v.change_type === "status_change" ? "Status changed" : v.change_type === "created" ? "Created" : "Edited"}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  v{v.version_number}{i === 0 ? " · current" : ""}
                </span>
              </div>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{formatRelative(v.created_at)}</span>
            </div>
          ))
        )}
      </RailPanel>
    </aside>
  );
}

function RailPanel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

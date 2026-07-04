import { AgentChip } from "@/components/aqli/badges";
import { IconGitMerge, IconArrowUpRight } from "@/components/aqli/icons";
import { formatDate, avatarColor } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

/**
 * The line under a doc title that states where the doc came from. Three modes,
 * derived from real doc fields:
 *   · pr     — created/updated by a merged PR (frontmatter.source_pr_url)
 *   · agent  — drafted by an agent (author_type === "agent")
 *   · human  — drafted by a teammate
 */
export default function ProvenanceBar({
  doc,
  ownerName,
}: {
  doc: DocWithSpace;
  ownerName: string | null;
}) {
  const prUrl = doc.frontmatter?.source_pr_url;

  if (prUrl) {
    const repo = doc.frontmatter?.source_repo;
    const prNumber = prUrl.match(/\/pull\/(\d+)/)?.[1];
    return (
      <Bar>
        <span style={{ color: "var(--accent)", display: "inline-flex" }}>
          <IconGitMerge size={13} />
        </span>
        <span>Source</span>
        <a
          href={prUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "var(--accent)",
            fontWeight: 500,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {repo ?? "repository"}
          {prNumber ? ` #${prNumber}` : ""}
          <IconArrowUpRight size={11} />
        </a>
        <Sep />
        {/* A PR-sourced doc can sit in review when auto-approve is off. */}
        {doc.status === "approved" ? (
          <span style={{ color: "var(--approved-text)", fontWeight: 500 }}>
            Auto-approved
          </span>
        ) : (
          <span style={{ color: "var(--review-text)", fontWeight: 500 }}>
            Awaiting review
          </span>
        )}
        <Sep />
        <span>{formatDate(doc.created_at)}</span>
      </Bar>
    );
  }

  if (doc.author_type === "agent") {
    const awaiting = doc.status === "draft" || doc.status === "review";
    return (
      <Bar>
        <span>Drafted by</span>
        <AgentChip label={doc.agent_id ?? "Agent"} />
        <Sep />
        <span style={{ color: awaiting ? "var(--review-text)" : "var(--text-secondary)" }}>
          {awaiting ? "Awaiting review" : "Approved"}
        </span>
        <Sep />
        <span>{formatDate(doc.created_at)}</span>
      </Bar>
    );
  }

  return (
    <Bar>
      <span>Drafted by</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span className="avatar avatar-sm" style={{ background: avatarColor(ownerName ?? "?") }}>
          {(ownerName ?? "?").charAt(0).toUpperCase()}
        </span>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
          {ownerName ?? "Team member"}
        </span>
      </span>
      {doc.status === "approved" && (
        <>
          <Sep />
          <span style={{ color: "var(--approved-text)", fontWeight: 500 }}>Approved</span>
        </>
      )}
      <Sep />
      <span>{formatDate(doc.created_at)}</span>
    </Bar>
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        fontSize: 12.5,
        color: "var(--text-muted)",
      }}
    >
      {children}
    </div>
  );
}

function Sep() {
  return <span style={{ color: "var(--border-strong)" }}>·</span>;
}

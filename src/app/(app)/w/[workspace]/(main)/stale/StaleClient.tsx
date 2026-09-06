"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TypeBadge } from "@/components/aqli/badges";
import { PageHeader, EmptyState } from "@/components/aqli/page";
import { IconCheck, IconClock } from "@/components/aqli/icons";
import { typeLabel } from "@/lib/doc-display";
import { formatDate } from "@/lib/utils";
import { CADENCE_LABEL, cadenceOf } from "@/lib/verify-cadence";
import type { DocWithSpace } from "@/types/doc";

function daysSinceReview(lastReviewedAt: string | null): number | null {
  if (!lastReviewedAt) return null;
  const reviewed = new Date(lastReviewedAt).getTime();
  return Math.floor((Date.now() - reviewed) / (1000 * 60 * 60 * 24));
}

type Props = {
  docs: DocWithSpace[];
  workspaceSlug: string;
};

export default function StaleClient({ docs, workspaceSlug }: Props) {
  const router = useRouter();
  const base = `/w/${workspaceSlug}`;
  const [loading, setLoading] = useState<string | null>(null);

  async function markReviewed(docId: string) {
    setLoading(docId);
    try {
      await fetch(`/api/docs/${docId}/reviewed`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="content" style={{ padding: "32px 40px" }}>
      <div className="page-col">
        <PageHeader
          eyebrow="Keeping it current"
          title="Needs updating"
          divider
          sub={
            <>
              Approved docs that are past their own re-verification cadence. They still
              serve your team and your AI, but someone should confirm they&apos;re current
              before they&apos;re treated as ground truth. A doc&apos;s cadence is set on
              the doc itself.
            </>
          }
        />

        {docs.length === 0 ? (
          <EmptyState
            tone="clear"
            icon={<IconCheck size={20} sw={2.2} />}
            title="All your approved docs are up to date"
          >
            Every one has been verified within the cadence it&apos;s held to.
          </EmptyState>
        ) : (
          <>
            <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 16 }}>
              {docs.length} {docs.length === 1 ? "doc needs" : "docs need"} verifying
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.map((doc) => {
                const days = daysSinceReview(doc.last_reviewed_at);
                const cadence = cadenceOf(doc.frontmatter?.verify_cadence);
                return (
                  <div
                    key={doc.id}
                    className="card stale-row"
                    style={{ alignItems: "center", padding: "14px 18px" }}
                  >
                    <TypeBadge type={typeLabel(doc.type)} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <Link
                        href={`${base}/docs/${doc.id}`}
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--text-primary)",
                          letterSpacing: "-0.005em",
                          textDecoration: "none",
                        }}
                      >
                        {doc.title}
                      </Link>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {doc.space?.name ?? "No space"}
                      </span>
                    </div>
                    <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                      {doc.last_reviewed_at
                        ? `Verified ${formatDate(doc.last_reviewed_at)}`
                        : "Never verified"}
                      {/* Why *this* doc is listed — without the cadence, a doc
                          checked 40 days ago looks arbitrarily flagged. */}
                      <span style={{ color: "var(--text-muted)" }}>
                        {" "}
                        · due {CADENCE_LABEL[cadence]}
                      </span>
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        height: 22,
                        padding: "0 8px",
                        borderRadius: 6,
                        background: "var(--stale-bg)",
                        color: "var(--stale-text)",
                        border: "1px solid var(--stale-border)",
                        fontSize: 11.5,
                        fontWeight: 500,
                        width: "fit-content",
                      }}
                    >
                      <IconClock size={11} />
                      {days === null ? "—" : `${days}d`}
                    </span>
                    <button
                      onClick={() => markReviewed(doc.id)}
                      disabled={loading === doc.id}
                      className="btn btn-secondary"
                      style={{ gap: 6, justifySelf: "end" }}
                    >
                      <IconCheck size={13} sw={2.2} />
                      <span>{loading === doc.id ? "Verifying…" : "Mark as verified"}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

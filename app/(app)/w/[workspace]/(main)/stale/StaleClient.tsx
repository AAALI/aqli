"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TypeBadge } from "@/components/aqli/badges";
import { IconCheck, IconClock } from "@/components/aqli/icons";
import { typeLabel } from "@/lib/doc-display";
import { formatDate } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

function daysSinceReview(lastReviewedAt: string | null): number | null {
  if (!lastReviewedAt) return null;
  const reviewed = new Date(lastReviewedAt).getTime();
  return Math.floor((Date.now() - reviewed) / (1000 * 60 * 60 * 24));
}

type Props = {
  docs: DocWithSpace[];
  workspaceSlug: string;
  staleDays: number;
};

export default function StaleClient({ docs, workspaceSlug, staleDays }: Props) {
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
      <header
        style={{
          display: "flex", flexDirection: "column", gap: 6,
          paddingBottom: 24, marginBottom: 24, borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Hygiene
        </div>
        <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 34, letterSpacing: "-0.015em", lineHeight: 1.1 }}>
          Stale docs
        </h1>
        <p style={{ margin: 0, maxWidth: 640, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          Approved docs not reviewed in {staleDays}+ days. Stale docs still serve agents, but a
          human should confirm they&apos;re current before they&apos;re treated as ground truth.
        </p>
      </header>

      {docs.length === 0 ? (
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: 240, color: "var(--text-muted)", gap: 8,
          }}
        >
          <span style={{ width: 44, height: 44, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-light)", color: "var(--accent)" }}>
            <IconCheck size={20} sw={2.2} />
          </span>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "var(--text-secondary)" }}>
            All your approved docs are up to date
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>Nothing has gone stale in the last {staleDays} days.</p>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 16 }}>
            {docs.length} {docs.length === 1 ? "doc needs" : "docs need"} a fresh review
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {docs.map((doc) => {
              const days = daysSinceReview(doc.last_reviewed_at);
              return (
                <div
                  key={doc.id}
                  className="card"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 150px 120px 150px",
                    gap: 14, alignItems: "center", padding: "14px 18px",
                  }}
                >
                  <TypeBadge type={typeLabel(doc.type)} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <Link
                      href={`${base}/docs/${doc.id}`}
                      style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em", textDecoration: "none" }}
                    >
                      {doc.title}
                    </Link>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {doc.space?.name ?? "No space"}
                    </span>
                  </div>
                  <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                    {doc.last_reviewed_at ? `Reviewed ${formatDate(doc.last_reviewed_at)}` : "Never reviewed"}
                  </span>
                  <span
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 8px",
                      borderRadius: 6, background: "var(--stale-bg)", color: "var(--stale-text)",
                      border: "1px solid var(--stale-border)", fontSize: 11.5, fontWeight: 500, width: "fit-content",
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
                    <span>{loading === doc.id ? "Marking…" : "Mark as Reviewed"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

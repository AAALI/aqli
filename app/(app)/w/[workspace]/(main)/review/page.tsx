import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import AppTopBar from "@/components/layout/AppTopBar";
import { TypeBadge } from "@/components/aqli/badges";
import { IconRobot } from "@/components/aqli/icons";
import { REVIEW_CARDS, type ReviewCard } from "@/lib/mock/reviews";

export default async function ReviewQueuePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Review Queue" }]} />
      <div className="content" style={{ padding: "28px 40px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.015em" }}>
            Review Queue
          </h1>
          <div style={{ marginTop: 4, fontSize: 13.5, color: "var(--text-secondary)" }}>
            {REVIEW_CARDS.length} docs waiting for your review
          </div>
        </div>
        <div className="fpills" style={{ marginBottom: 22 }}>
          {["All", "Fix Notes", "Architecture", "Compliance"].map((f, i) => (
            <button key={f} className={`fpill ${i === 0 ? "is-active" : ""}`}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 960 }}>
          {REVIEW_CARDS.map((c) => (
            <ReviewCardRow key={c.id} c={c} base={base} />
          ))}
        </div>
      </div>
    </>
  );
}

function ReviewCardRow({ c, base }: { c: ReviewCard; base: string }) {
  return (
    <div className="card agent-row" style={{ padding: "20px 24px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em", flex: 1 }}>
          <Link href={`${base}/review/${c.id}`} style={{ color: "inherit", textDecoration: "none" }}>
            {c.title}
          </Link>
        </h3>
        <TypeBadge type={c.type} />
        <span className="agent-chip">
          <IconRobot size={12} />
          Written by {c.agent}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-secondary)" }}>{c.body}</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12.5, color: "var(--text-muted)" }}>
          <span>{c.foot}</span>
          {c.diff && (
            <span style={{ display: "inline-flex", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
              <span style={{ color: "var(--approved-text)" }}>+{c.diff.added}</span>
              <span style={{ color: "#993C1D" }}>−{c.diff.removed}</span>
              <span>· {c.diff.files} files</span>
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href={`${base}/review/${c.id}`} className="btn btn-ghost btn-ghost-danger">Reject</Link>
          <Link href={`${base}/review/${c.id}`} className="btn btn-secondary">Request Changes</Link>
          <Link href={`${base}/review/${c.id}`} className="btn btn-primary">Approve</Link>
        </div>
      </div>
    </div>
  );
}

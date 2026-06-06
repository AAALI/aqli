import Link from "next/link";
import { StatusBadge, TypeBadge } from "@/components/aqli/badges";
import { IconDots, IconRobot } from "@/components/aqli/icons";
import { typeLabel, statusLabel } from "@/lib/doc-display";
import { formatRelative } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

export default function DocCard({
  doc,
  workspaceSlug,
}: {
  doc: DocWithSpace;
  workspaceSlug: string;
}) {
  const isAgent = doc.author_type === "agent";
  return (
    <Link
      href={`/w/${workspaceSlug}/docs/${doc.id}`}
      className={`doc-row${isAgent ? " agent-row" : ""}`}
      style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr 110px 150px 100px 28px",
        alignItems: "center",
        gap: 16,
        padding: "14px 18px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      <TypeBadge type={typeLabel(doc.type)} />
      <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {doc.title}
      </div>
      <StatusBadge status={statusLabel(doc.status)} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
        {isAgent ? (
          <>
            <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--agent-tint)", border: "1px solid var(--agent-border)", color: "var(--agent-icon)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <IconRobot size={13} />
            </span>
            <span>Agent</span>
          </>
        ) : (
          <>
            <span className="avatar avatar-sm avatar-ali">·</span>
            <span>Member</span>
          </>
        )}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{formatRelative(doc.updated_at)}</div>
      <span style={{ color: "var(--text-muted)", display: "flex", justifyContent: "center" }}>
        <IconDots size={16} />
      </span>
    </Link>
  );
}

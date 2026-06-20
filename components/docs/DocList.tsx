import DocCard from "./DocCard";
import type { OwnerInfo } from "@/lib/supabase/owners";
import type { DocWithSpace } from "@/types/doc";

export default function DocList({
  docs,
  workspaceSlug,
  emptyLabel = "No docs yet.",
  owners,
}: {
  docs: DocWithSpace[];
  workspaceSlug: string;
  emptyLabel?: string;
  /** `user_id → display info`, used to name human authors. */
  owners?: Record<string, OwnerInfo>;
}) {
  if (docs.length === 0) {
    return (
      <div
        style={{
          border: "1px dashed var(--border-strong)",
          borderRadius: 12,
          padding: "44px 32px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-muted)",
          background: "var(--bg-card)",
        }}
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {docs.map((doc) => (
        <DocCard
          key={doc.id}
          doc={doc}
          workspaceSlug={workspaceSlug}
          owner={doc.owner_id ? owners?.[doc.owner_id] : undefined}
        />
      ))}
    </div>
  );
}

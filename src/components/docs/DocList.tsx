import DocCard from "./DocCard";
import { EmptyState } from "@/components/aqli/page";
import type { OwnerInfo } from "@/lib/supabase/owners";
import type { DocWithSpace } from "@/types/doc";

export default function DocList({
  docs,
  workspaceSlug,
  emptyLabel = "No docs here yet",
  owners,
}: {
  docs: DocWithSpace[];
  workspaceSlug: string;
  /** Empty pass `""` to render nothing — used where a caller owns the empty case. */
  emptyLabel?: string;
  /** `user_id → display info`, used to name human authors. */
  owners?: Record<string, OwnerInfo>;
}) {
  if (docs.length === 0) {
    if (!emptyLabel) return null;
    return <EmptyState title={emptyLabel} />;
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

import DocCard from "./DocCard";
import type { DocWithSpace } from "@/types/doc";

export default function DocList({
  docs,
  workspaceSlug,
  emptyLabel = "No docs yet.",
}: {
  docs: DocWithSpace[];
  workspaceSlug: string;
  emptyLabel?: string;
}) {
  if (docs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-400">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {docs.map((doc) => (
        <DocCard key={doc.id} doc={doc} workspaceSlug={workspaceSlug} />
      ))}
    </div>
  );
}

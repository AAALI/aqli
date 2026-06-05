import Link from "next/link";
import DocStatusBadge from "./DocStatusBadge";
import { formatRelative } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

export default function DocCard({
  doc,
  workspaceSlug,
}: {
  doc: DocWithSpace;
  workspaceSlug: string;
}) {
  return (
    <Link
      href={`/w/${workspaceSlug}/docs/${doc.id}`}
      className="block rounded-lg border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-neutral-900">{doc.title}</h3>
        <DocStatusBadge status={doc.status} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
        <span className="capitalize">{doc.type.replace("_", " ")}</span>
        {doc.space && (
          <>
            <span>·</span>
            <span>
              {doc.space.icon} {doc.space.name}
            </span>
          </>
        )}
        <span>·</span>
        <span>Updated {formatRelative(doc.updated_at)}</span>
        {doc.author_type === "agent" && (
          <>
            <span>·</span>
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-violet-700">
              agent
            </span>
          </>
        )}
      </div>
    </Link>
  );
}

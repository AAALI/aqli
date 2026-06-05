import { formatRelative } from "@/lib/utils";
import type { DocVersion } from "@/types/doc";

const changeLabels: Record<string, string> = {
  created: "Created",
  edit: "Edited",
  status_change: "Status changed",
};

export default function VersionHistory({
  versions,
}: {
  versions: DocVersion[];
}) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-neutral-400">
        No versions yet. Versions are snapshotted when status changes.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
      {versions.map((v) => (
        <li
          key={v.id}
          className="flex items-center justify-between px-4 py-2 text-sm"
        >
          <span className="text-neutral-700">
            v{v.version_number}{" "}
            <span className="text-neutral-400">
              · {changeLabels[v.change_type ?? ""] ?? v.change_type}
            </span>
          </span>
          <span className="text-xs text-neutral-400">
            {formatRelative(v.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}

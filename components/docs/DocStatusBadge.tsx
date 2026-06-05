import Badge from "@/components/ui/Badge";
import type { DocStatus } from "@/types/doc";

const styles: Record<DocStatus, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  stale: "bg-orange-100 text-orange-700",
  archived: "bg-neutral-200 text-neutral-500",
};

export default function DocStatusBadge({ status }: { status: DocStatus }) {
  return (
    <Badge className={`${styles[status]} capitalize`}>{status}</Badge>
  );
}

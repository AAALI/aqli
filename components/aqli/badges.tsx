import { IconRobot } from "./icons";

export type DocStatus = "Draft" | "Review" | "Approved" | "Stale" | "Archived";

const STATUS_CLASS: Record<string, string> = {
  Draft: "badge-draft",
  Review: "badge-review",
  Approved: "badge-approved",
  Stale: "badge-stale",
  Archived: "badge-archived",
};

export function StatusBadge({ status }: { status: string }) {
  const label = status ? status[0].toUpperCase() + status.slice(1) : "Draft";
  return (
    <span className={`badge ${STATUS_CLASS[label] || "badge-draft"}`}>
      <span className="dot" />
      {label}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return <span className="badge badge-type">{type}</span>;
}

export function AgentChip({ label = "Agent" }: { label?: string }) {
  return (
    <span className="agent-chip">
      <IconRobot size={12} />
      {label}
    </span>
  );
}

import { IconRobot, IconGitMerge } from "./icons";

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

/**
 * Distinct from the `Approved` status badge: marks a doc that entered as
 * Approved via the GitHub auto-approve path, so an auditor can tell at a glance.
 */
export function AutoApprovedChip() {
  return (
    <span
      className="badge"
      style={{
        background: "var(--approved-bg)",
        color: "var(--approved-text)",
        borderColor: "var(--approved-border)",
      }}
    >
      <IconGitMerge size={12} />
      Auto-approved
    </span>
  );
}

export function AgentChip({ label = "Agent" }: { label?: string }) {
  return (
    <span className="agent-chip">
      <IconRobot size={12} />
      {label}
    </span>
  );
}

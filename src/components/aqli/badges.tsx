import { IconRobot } from "./icons";
import { avatarColor } from "@/lib/utils";

export function TypeBadge({ type }: { type: string }) {
  return <span className="badge badge-type">{type}</span>;
}

export function AgentChip({ label = "Agent" }: { label?: string }) {
  return (
    <span className="agent-chip">
      {/* Per-agent identity: the icon well is tinted by the agent id, so two
          agents in the same feed are tellable apart at a glance. */}
      <span
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          background: avatarColor(label),
          color: "#fff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
        }}
      >
        <IconRobot size={10} />
      </span>
      {label}
    </span>
  );
}

import Link from "next/link";
import { IconChevDown } from "./icons";

export function SpaceHeader({
  emoji,
  name,
  sub,
  filters,
  activeFilter = "All",
}: {
  emoji: string;
  name: string;
  sub: string;
  filters?: string[];
  activeFilter?: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 28, lineHeight: 1, filter: "saturate(0.85)" }}>{emoji}</span>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
          {name}
        </h1>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginLeft: 40, marginBottom: 22 }}>
        {sub}
      </div>
      {filters && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="fpills">
            {filters.map((f) => (
              <button key={f} className={`fpill ${f === activeFilter ? "is-active" : ""}`}>{f}</button>
            ))}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>
            <span style={{ color: "var(--text-muted)" }}>Sort:</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Updated</span>
            <IconChevDown size={13} />
          </div>
        </div>
      )}
    </div>
  );
}

export { Link };

import type { ReactNode } from "react";
import { AqliMark } from "@/components/aqli/AqliMark";

export function AuthStage({ ornament, children }: { ornament: ReactNode; children: ReactNode }) {
  return (
    <div className="aqli-screen" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "560px 1fr", background: "var(--bg-base)", fontFamily: "var(--font-sans)" }}>
      <div style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border)", padding: "44px 48px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AqliMark size={22} />
          <span style={{ fontSize: 17, letterSpacing: "0.08em", fontWeight: 500, color: "var(--text-primary)" }}>AQLI</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
          {ornament}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 4 }}>
          <span>Open source · MIT</span>
          <span>aqli.app · docs.aqli.app</span>
        </div>
      </div>
      <div style={{ padding: "44px 64px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>{children}</div>
      </div>
    </div>
  );
}

export function AuthField({ label, trailing, children }: { label: string; trailing?: ReactNode; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
        {trailing}
      </div>
      {children}
    </label>
  );
}

export function authInputStyle(focused?: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 40,
    padding: "0 12px",
    width: "100%",
    background: "var(--bg-card)",
    border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
    boxShadow: focused ? "0 0 0 3px rgba(15,110,86,0.12)" : "none",
    borderRadius: 8,
    fontSize: 14,
    color: "var(--text-primary)",
    fontFamily: "var(--font-sans)",
    outline: "none",
  };
}

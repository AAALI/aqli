import type { ReactNode } from "react";
import { IconChevDown } from "@/components/aqli/icons";

export function SettingsHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, paddingBottom: 22, borderBottom: "1px solid var(--border)", marginBottom: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 34, letterSpacing: "-0.015em", lineHeight: 1.1 }}>{title}</h1>
        {sub && <p style={{ margin: 0, maxWidth: 620, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function SettingsCard({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "22px 24px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{title}</h3>
          {sub && <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>{hint}</span>}
    </label>
  );
}

export function Input({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <input
      readOnly
      defaultValue={value}
      style={{ display: "flex", alignItems: "center", height: 36, padding: "0 12px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", fontSize: mono ? 12.5 : 13.5, color: "var(--text-primary)", width: "100%" }}
    />
  );
}

export function Select({ value, mono, pinned }: { value: string; mono?: boolean; pinned?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 36, padding: "0 12px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", fontSize: mono ? 12.5 : 13.5, color: "var(--text-primary)", cursor: "pointer" }}>
      <span style={{ flex: 1 }}>{value}</span>
      {pinned && <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginRight: 8, fontFamily: "var(--font-sans)" }}>recommended</span>}
      <IconChevDown size={13} />
    </div>
  );
}

export function Toggle({ label, desc, on }: { label: string; desc: string; on?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 40px", gap: 16, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>{desc}</span>
      </div>
      <Switch on={on} />
    </div>
  );
}

export function Switch({ on }: { on?: boolean }) {
  return (
    <span style={{ width: 32, height: 18, borderRadius: 999, background: on ? "var(--accent)" : "var(--border-strong)", position: "relative", justifySelf: "end", display: "inline-block" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
    </span>
  );
}

export function RadioRow({ label, desc, on }: { label: string; desc: string; on?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 12, alignItems: "start", padding: "10px 12px", background: on ? "var(--accent-light)" : "var(--bg-base)", border: `1px solid ${on ? "rgba(15,110,86,0.3)" : "var(--border)"}`, borderRadius: 8 }}>
      <span style={{ width: 16, height: 16, borderRadius: 999, border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`, background: on ? "var(--accent)" : "transparent", position: "relative", marginTop: 2 }}>
        {on && <span style={{ position: "absolute", top: 3, left: 3, width: 7, height: 7, borderRadius: 999, background: "#fff" }} />}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: on ? "var(--accent)" : "var(--text-primary)" }}>{label}</span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{desc}</span>
      </div>
    </div>
  );
}

export function StatCell({ label, value, hint, last, color }: { label: string; value: string; hint?: string; last?: boolean; color?: string }) {
  return (
    <div style={{ padding: "16px 20px", borderRight: last ? "none" : "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-serif)", fontSize: 24, fontWeight: 400, color: color || "var(--text-primary)", lineHeight: 1.1 }}>{value}</span>
      {hint && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{hint}</span>}
    </div>
  );
}

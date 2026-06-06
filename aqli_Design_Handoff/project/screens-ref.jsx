// Aqli — Reference panels: Color tokens + Components
const { StatusBadge, TypeBadge, AgentChip, IconSearch, IconPlus, AqliMark } = window;

// ── Token Reference ──────────────────────────────────────────────────
const Swatch = ({ name, val, big = false }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
    <div style={{
      width: big ? 56 : 36, height: big ? 56 : 36,
      borderRadius: 8,
      background: val,
      border: "1px solid rgba(0,0,0,0.08)",
      flex: "0 0 auto",
    }}></div>
    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{name}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{val}</span>
    </div>
  </div>
);

const TokenGroup = ({ label, tokens, big = false }) => (
  <div>
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
      color: "var(--text-muted)", marginBottom: 8,
    }}>{label}</div>
    {tokens.map((t) => <Swatch key={t.name} {...t} big={big} />)}
  </div>
);

const LIGHT_TOKENS = [
  { name: "bg-base", val: "#FAFAF8" },
  { name: "bg-sidebar", val: "#F2F1ED" },
  { name: "bg-card", val: "#FFFFFF" },
  { name: "border", val: "#E5E4DF" },
  { name: "text-primary", val: "#1A1A18" },
  { name: "text-secondary", val: "#6B6A64" },
  { name: "text-muted", val: "#9E9D96" },
  { name: "accent", val: "#0F6E56" },
  { name: "accent-light", val: "#E1F5EE" },
];

const DARK_TOKENS = [
  { name: "bg-base", val: "#141412" },
  { name: "bg-sidebar", val: "#1C1C1A" },
  { name: "bg-card", val: "#1F1F1D" },
  { name: "border", val: "#2A2A27" },
  { name: "text-primary", val: "#F0EFE9" },
  { name: "text-secondary", val: "#8A8980" },
  { name: "accent", val: "#1D9E75" },
  { name: "accent-light", val: "#04342C" },
];

const STATUS_ROWS = [
  { name: "Draft", bg: "#F2F1ED", text: "#6B6A64", border: "#E5E4DF" },
  { name: "Review", bg: "#FAEEDA", text: "#854F0B", border: "#FAC775" },
  { name: "Approved", bg: "#E1F5EE", text: "#0F6E56", border: "#9FE1CB" },
  { name: "Stale", bg: "#FAECE7", text: "#993C1D", border: "#F5C4B3" },
  { name: "Archived", bg: "#F2F1ED", text: "#9E9D96", border: "#E5E4DF" },
];

const TokensRef = () => (
  <div style={{
    width: 1440, height: 900,
    background: "var(--bg-base)",
    color: "var(--text-primary)",
    padding: "44px 56px",
    fontFamily: "var(--font-sans)",
    overflow: "hidden",
  }} data-screen-label="Reference · Tokens">
    <header style={{ marginBottom: 32, display: "flex", alignItems: "baseline", gap: 16 }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 36, letterSpacing: "-0.015em" }}>
        Colour tokens
      </h1>
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Light, dark, and status — referenced as CSS custom properties.
      </span>
    </header>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 40 }}>
      {/* Light mode */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "24px 28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999, background: "#1A1A18",
            border: "1px solid var(--border)",
          }}></span>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Light mode</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>Primary</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <TokenGroup label="Surfaces" tokens={LIGHT_TOKENS.slice(0, 4)} />
          <TokenGroup label="Text & Accent" tokens={LIGHT_TOKENS.slice(4)} />
        </div>
      </div>

      {/* Dark mode */}
      <div className="dark" style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 12, padding: "24px 28px",
        color: "var(--text-primary)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999, background: "#F0EFE9",
          }}></span>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Dark mode</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>Secondary</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <TokenGroup label="Surfaces" tokens={DARK_TOKENS.slice(0, 4)} />
          <TokenGroup label="Text & Accent" tokens={DARK_TOKENS.slice(4)} />
        </div>
      </div>
    </div>

    {/* Status row */}
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "24px 28px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Status palette</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>Identical in both modes</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
        {STATUS_ROWS.map((s) => (
          <div key={s.name} style={{
            background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
            padding: "16px 16px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: s.text, fontSize: 13, fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }}></span>
              {s.name}
            </div>
            <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: s.text, opacity: 0.85, lineHeight: 1.55 }}>
              <div>bg {s.bg}</div>
              <div>fg {s.text}</div>
              <div>br {s.border}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          padding: "10px 14px", borderRadius: 8,
          background: "var(--agent-tint)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--agent-border)",
          flex: 1,
        }}>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Agent-authored indicator</strong> — 3px amber left border + 8% amber tint. Used wherever an AI agent has written or modified content awaiting human review.
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ── Component Reference ──────────────────────────────────────────────
const CompSection = ({ title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{
      fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase",
      color: "var(--text-muted)", marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid var(--border)",
    }}>{title}</div>
    {children}
  </div>
);

const Tile = ({ children, label, w }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: w ? `0 0 ${w}px` : "0 0 auto" }}>
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8,
      padding: "20px 18px",
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: 64,
    }}>
      {children}
    </div>
    <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{label}</span>
  </div>
);

const ComponentsRef = () => (
  <div style={{
    width: 1440, height: 900,
    background: "var(--bg-base)",
    color: "var(--text-primary)",
    padding: "44px 56px",
    fontFamily: "var(--font-sans)",
    overflow: "hidden",
  }} data-screen-label="Reference · Components">
    <header style={{ marginBottom: 28, display: "flex", alignItems: "baseline", gap: 16 }}>
      <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 36, letterSpacing: "-0.015em" }}>
        Components
      </h1>
      <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Buttons, badges, indicators, inputs.
      </span>
    </header>

    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 36 }}>
      {/* Left column: buttons, statuses, types */}
      <div>
        <CompSection title="Buttons">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Tile label="primary">
              <button className="btn btn-primary"><IconPlus size={14} />New Doc</button>
            </Tile>
            <Tile label="secondary">
              <button className="btn btn-secondary">Share</button>
            </Tile>
            <Tile label="ghost">
              <button className="btn btn-ghost">Cancel</button>
            </Tile>
            <Tile label="ghost-danger">
              <button className="btn btn-ghost btn-ghost-danger">Reject</button>
            </Tile>
          </div>
        </CompSection>

        <CompSection title="Status badges">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {["Draft", "Review", "Approved", "Stale", "Archived"].map((s) => (
              <Tile key={s} label={s.toLowerCase()}>
                <StatusBadge status={s} />
              </Tile>
            ))}
          </div>
        </CompSection>

        <CompSection title="Doc type badges">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {["PRD", "ADR", "Runbook", "Fix Note", "Policy"].map((t) => (
              <Tile key={t} label={t.toLowerCase()}>
                <TypeBadge type={t} />
              </Tile>
            ))}
          </div>
        </CompSection>
      </div>

      {/* Right column: agent indicator, inputs, search bar */}
      <div>
        <CompSection title="Agent indicator">
          <div style={{
            background: "var(--bg-card)", borderRadius: 8,
            border: "1px solid var(--border)", borderLeft: "3px solid var(--agent-border)",
            padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span className="agent-chip">
              <span style={{ display: "inline-flex" }}>🤖</span>
              Written by Claude Code
            </span>
            <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
              Fix: Payout retry on transient bank failures
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Cards and rows authored by an agent carry a 3px amber left border and an 8% amber tint.
          </div>
        </CompSection>

        <CompSection title="Input fields">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Default</label>
            <input defaultValue="Host Payout Schedule PRD" style={{
              height: 38, padding: "0 12px",
              border: "1px solid var(--border)",
              borderRadius: 8, background: "var(--bg-card)",
              fontFamily: "var(--font-sans)", fontSize: 13.5, color: "var(--text-primary)",
              outline: "none",
            }} />
            <label style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>Focused</label>
            <div style={{
              height: 38, padding: "0 12px",
              border: "1px solid var(--accent)",
              borderRadius: 8, background: "var(--bg-card)",
              fontSize: 13.5, color: "var(--text-primary)",
              display: "flex", alignItems: "center",
              boxShadow: "0 0 0 3px rgba(15,110,86,0.12)",
            }}>
              Search Ranking Service Runbook<span style={{ display: "inline-block", width: 2, height: 16, background: "var(--accent)", marginLeft: 2, animation: "aqli-blink 1.05s steps(1) infinite" }}></span>
            </div>
          </div>
        </CompSection>

        <CompSection title="Search bar">
          <div style={{
            height: 44, padding: "0 14px",
            border: "1px solid var(--border-strong)",
            borderRadius: 10, background: "var(--bg-card)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ color: "var(--text-secondary)" }}><IconSearch size={16} /></span>
            <span style={{ flex: 1, fontSize: 14, color: "var(--text-muted)" }}>Search docs, agents, decisions…</span>
            <span style={{
              fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)",
              padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4,
            }}>⌘K</span>
          </div>
        </CompSection>
      </div>
    </div>
    <style>{`@keyframes aqli-blink{50%{opacity:0}}`}</style>
  </div>
);

Object.assign(window, { TokensRef, ComponentsRef });

"use client";

import { useState, type ReactNode } from "react";
import {
  IconRobot,
  IconDots,
  IconPlus,
  IconBook,
  IconArrowUpRight,
  IconKey,
  IconCheck,
  IconWarn,
  IconX,
  IconChevDown,
} from "@/components/aqli/icons";
import { SettingsHeader, StatCell, FormField } from "@/components/settings/primitives";
import { SAMPLE_KEYS, type ApiKey } from "@/lib/mock/settings";

type Modal = null | "new" | "reveal";

export default function KeysClient() {
  const [modal, setModal] = useState<Modal>(null);
  const dim = modal !== null;

  return (
    <div className="content" style={{ padding: "32px 44px", position: "relative", overflow: dim ? "hidden" : "auto" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", opacity: dim ? 0.4 : 1 }}>
        <SettingsHeader
          title="API keys"
          sub="Each key lets one agent read approved context and create docs in this workspace. Agent-authored docs land in Draft until a human approves them."
          action={
            <button className="btn btn-primary" onClick={() => setModal("new")}>
              <IconPlus size={14} sw={2} />
              <span>New API key</span>
            </button>
          }
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 22, overflow: "hidden" }}>
          <StatCell label="Active keys" value="3" />
          <StatCell label="Reads · 7 days" value="1,284" />
          <StatCell label="Writes · 7 days" value="14" hint="11 approved, 3 pending" />
          <StatCell label="Most active" value="Claude Code" hint="2 minutes ago" last />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SAMPLE_KEYS.map((k, i) => <KeyRow key={i} k={k} />)}
        </div>

        <div style={{ marginTop: 28, padding: "16px 20px", background: "var(--bg-sidebar)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            <IconBook size={14} />
          </span>
          <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            See the <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>agent API reference</strong> for endpoint shapes, response schemas, and example agents (Claude Code, Cursor, LangChain).
          </div>
          <span style={{ color: "var(--text-secondary)", display: "flex" }}><IconArrowUpRight size={14} /></span>
        </div>
      </div>

      {dim && (
        <>
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,20,18,0.32)", zIndex: 50 }} onClick={() => setModal(null)} />
          {modal === "new" && <NewKeyModal onCancel={() => setModal(null)} onCreate={() => setModal("reveal")} />}
          {modal === "reveal" && <RevealModal onClose={() => setModal(null)} />}
        </>
      )}
    </div>
  );
}

function KeyRow({ k }: { k: ApiKey }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 140px 180px 28px", gap: 16, alignItems: "center", padding: "18px 20px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
      <span style={{ width: 36, height: 36, borderRadius: 8, background: "var(--agent-tint)", border: "1px solid var(--agent-border)", color: "var(--agent-icon)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IconRobot size={18} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{k.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--text-muted)" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{k.preview}</span>
          <span>·</span>
          <span>Created {k.created} by {k.createdBy}</span>
        </div>
      </div>
      <ScopeChip scope={k.scope} />
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
        <div>{k.lastUsed === "Never" ? "Never used" : `Last used ${k.lastUsed}`}</div>
        <div style={{ color: "var(--text-muted)", fontSize: 11.5, marginTop: 2 }}>{k.usage}</div>
      </div>
      <span style={{ color: "var(--text-muted)", justifySelf: "center", cursor: "pointer" }}><IconDots size={16} /></span>
    </div>
  );
}

function ScopeChip({ scope }: { scope: ApiKey["scope"] }) {
  const palette = {
    read: { bg: "var(--draft-bg)", color: "var(--draft-text)", border: "var(--draft-border)" },
    write: { bg: "var(--accent-light)", color: "var(--accent)", border: "rgba(15,110,86,0.25)" },
    review: { bg: "var(--review-bg)", color: "var(--review-text)", border: "var(--review-border)" },
  }[scope.kind];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 6, background: palette.bg, color: palette.color, border: `1px solid ${palette.border}`, fontSize: 12, fontWeight: 500, letterSpacing: "-0.005em", width: "fit-content" }}>
      {scope.label}
    </span>
  );
}

const MODAL_SHELL: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "0 18px 48px -12px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.06)",
  padding: "24px 26px",
  zIndex: 51,
  maxHeight: "calc(100% - 64px)",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  overflow: "auto",
};

function NewKeyModal({ onCancel, onCreate }: { onCancel: () => void; onCreate: () => void }) {
  return (
    <div style={{ ...MODAL_SHELL, width: 480 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>Create API key</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>Generate a key for a new agent. You&apos;ll see the full key once.</p>
      </div>
      <FormField label="Name" hint="Pick something specific — agent + machine helps if a key needs to be revoked.">
        <input autoFocus defaultValue="Cursor · Khalid's MacBook" style={{ height: 36, padding: "0 12px", background: "var(--bg-base)", border: "1px solid var(--accent)", boxShadow: "0 0 0 3px rgba(15,110,86,0.12)", borderRadius: 6, fontSize: 13.5, color: "var(--text-primary)", fontFamily: "inherit" }} />
      </FormField>
      <FormField label="Scope" hint="What this agent is allowed to do.">
        <ScopeRadio />
      </FormField>
      <FormField label="Allowed spaces" hint="The agent can only read and write docs in these spaces.">
        <MultiPick />
      </FormField>
      <FormField label="Expires">
        <div style={{ display: "flex", alignItems: "center", height: 36, padding: "0 12px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13.5, color: "var(--text-primary)", cursor: "pointer" }}>
          <span style={{ flex: 1 }}>Never</span>
          <IconChevDown size={13} />
        </div>
      </FormField>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onCreate}>
          <IconKey size={13} /><span>Create key</span>
        </button>
      </div>
    </div>
  );
}

function ScopeRadio() {
  const opts = [
    { id: "read", label: "Read only", desc: "Query approved docs. Cannot write." },
    { id: "write", label: "Read + write", desc: "Query, then create drafts for human review.", on: true },
    { id: "review", label: "Read + write + review", desc: "Plus mark its own docs for review. For trusted, supervised agents." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {opts.map((o) => (
        <div key={o.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 12, alignItems: "start", padding: "12px 14px", background: o.on ? "var(--accent-light)" : "var(--bg-base)", border: `1px solid ${o.on ? "rgba(15,110,86,0.3)" : "var(--border)"}`, borderRadius: 8, cursor: "pointer" }}>
          <span style={{ width: 16, height: 16, borderRadius: 999, border: `1.5px solid ${o.on ? "var(--accent)" : "var(--border-strong)"}`, background: o.on ? "var(--accent)" : "transparent", position: "relative", marginTop: 2 }}>
            {o.on && <span style={{ position: "absolute", top: 3, left: 3, width: 7, height: 7, borderRadius: 999, background: "#fff" }} />}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: o.on ? "var(--accent)" : "var(--text-primary)" }}>{o.label}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{o.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MultiPick() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "8px 10px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, minHeight: 36 }}>
      {["📋 Product", "⚙️ Engineering"].map((t) => (
        <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, color: "var(--text-primary)" }}>
          {t}
          <span style={{ color: "var(--text-muted)", marginLeft: 2, cursor: "pointer", display: "flex" }}><IconX size={10} /></span>
        </span>
      ))}
      <span style={{ fontSize: 12, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", padding: "0 4px" }}>+ Add space</span>
    </div>
  );
}

function RevealModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ ...MODAL_SHELL, width: 520 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--review-bg)", border: "1px solid var(--review-border)", borderRadius: 8 }}>
        <span style={{ color: "var(--review-text)", display: "flex" }}><IconWarn size={18} /></span>
        <div style={{ flex: 1, fontSize: 13, color: "var(--review-text)", lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 600 }}>Save this key now.</strong> This is the only time the full key will be shown. Store it in your password manager or secrets vault.
        </div>
      </div>
      <Label>Cursor · Khalid&apos;s MacBook</Label>
      <CodeBlock value="aqli_live_8a3f4d2b9c1e6f0a7b8d3e5c2f4a1d9e7c2" />
      <Label>Quick test</Label>
      <CodeBlock multi value={[
        "curl https://your-aqli.app/api/agent/context \\",
        '  -H "Authorization: Bearer aqli_live_8a3f…" \\',
        '  -G --data-urlencode "query=payout retry"',
      ]} />
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Add this key as <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, background: "var(--bg-sidebar)", padding: "1px 6px", borderRadius: 4, color: "var(--text-secondary)" }}>AQLI_API_KEY</code> in your agent&apos;s environment.
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <button className="btn btn-ghost" style={{ color: "var(--text-secondary)" }}>View agent API docs</button>
        <button className="btn btn-primary" onClick={onClose}>
          <IconCheck size={13} sw={2.2} /><span>I&apos;ve saved it</span>
        </button>
      </div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>{children}</div>;
}

function CodeBlock({ value, multi }: { value: string | string[]; multi?: boolean }) {
  return (
    <div style={{ position: "relative", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: multi ? "12px 14px" : "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre", overflow: "auto" }}>
      <div style={{ paddingRight: 30 }}>
        {Array.isArray(value) ? value.map((l, i) => <div key={i}>{l}</div>) : value}
      </div>
    </div>
  );
}

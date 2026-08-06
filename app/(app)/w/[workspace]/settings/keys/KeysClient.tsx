"use client";

import { useState, type ReactNode } from "react";
import {
  IconRobot,
  IconPlus,
  IconBook,
  IconArrowUpRight,
  IconKey,
  IconCheck,
  IconWarn,
  IconTrash,
} from "@/components/aqli/icons";
import { SettingsHeader, StatCell, FormField } from "@/components/settings/primitives";
import { DEFAULT_AGENT_SCOPES } from "@/lib/agent-scopes";
import type { AgentScope } from "@/lib/merge/disposition";

type KeyRowData = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  scopes: AgentScope[];
};

/**
 * `read` is not offered: every agent endpoint reads before it writes, so a key
 * without it does nothing, and the server adds it back regardless.
 *
 * What `write` actually changes is decided by `decideDisposition` — it is the
 * difference between an agent's change queueing and merging, and only in a
 * space set to "Agents reviewed". In a "Everything reviewed" space it queues
 * either way, which is why the description says "unless the space reviews
 * everything" rather than promising it lands.
 */
const SCOPE_OPTIONS: { value: AgentScope; label: string; description: string }[] = [
  {
    value: "propose",
    label: "Propose",
    description: "Submit changes to the review queue for a human to approve.",
  },
  {
    value: "write",
    label: "Write directly",
    description:
      "Changes merge without review — unless the space reviews everything.",
  },
];

function ScopeChips({
  scopes,
  editable,
  busy,
  onToggle,
}: {
  scopes: AgentScope[];
  editable: boolean;
  busy?: boolean;
  onToggle: (scope: AgentScope, next: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span
        title="Every key can read approved context."
        style={{ ...chipStyle, color: "var(--text-muted)", borderColor: "var(--border)" }}
      >
        read
      </span>
      {SCOPE_OPTIONS.map((opt) => {
        const on = scopes.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={!editable || busy}
            title={opt.description}
            onClick={() => onToggle(opt.value, !on)}
            style={{
              ...chipStyle,
              cursor: editable && !busy ? "pointer" : "default",
              opacity: busy ? 0.5 : 1,
              background: on ? "var(--accent-light)" : "transparent",
              borderColor: on ? "rgba(15,110,86,0.28)" : "var(--border)",
              color: on ? "var(--accent)" : "var(--text-muted)",
              fontWeight: on ? 600 : 500,
            }}
          >
            {opt.label.toLowerCase()}
          </button>
        );
      })}
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "0.01em",
  lineHeight: 1.6,
  whiteSpace: "nowrap",
};

type Modal = null | "new" | "reveal";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function fmtWhen(iso: string | null): string {
  if (!iso) return "Never used";
  return "Last used " + new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function KeysClient({
  workspaceId,
  appUrl,
  canManage,
  initialKeys,
}: {
  workspaceId: string;
  appUrl: string;
  canManage: boolean;
  initialKeys: KeyRowData[];
}) {
  const [keys, setKeys] = useState<KeyRowData[]>(initialKeys);
  const [modal, setModal] = useState<Modal>(null);
  const [name, setName] = useState("");
  const [newScopes, setNewScopes] = useState<AgentScope[]>(DEFAULT_AGENT_SCOPES);
  const [busy, setBusy] = useState(false);
  const [scopeBusy, setScopeBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [revealName, setRevealName] = useState("");
  const dim = modal !== null;

  const agentBase = `${appUrl}/api/agent`;

  function openNew() {
    setName("");
    setNewScopes(DEFAULT_AGENT_SCOPES);
    setError(null);
    setModal("new");
  }

  async function setScopes(key: KeyRowData, scopes: AgentScope[]) {
    const previous = key.scopes;
    // Optimistic — the chip is the control, so it has to respond to the click.
    setKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, scopes } : k)));
    setScopeBusy(key.id);
    setError(null);
    try {
      const res = await fetch(`/api/keys/${key.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update this key");
      // The server has the last word on the set it stored.
      setKeys((prev) =>
        prev.map((k) => (k.id === key.id ? { ...k, scopes: data.scopes } : k)),
      );
    } catch (e) {
      setKeys((prev) =>
        prev.map((k) => (k.id === key.id ? { ...k, scopes: previous } : k)),
      );
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setScopeBusy(null);
    }
  }

  async function createKey() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: name.trim(),
          scopes: newScopes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create key");
      const k = data.key;
      setSecret(k.secret);
      setRevealName(k.name);
      setKeys((prev) => [
        {
          id: k.id,
          name: k.name,
          key_prefix: k.key_prefix,
          last_used_at: null,
          created_at: k.created_at,
          scopes: k.scopes ?? newScopes,
        },
        ...prev,
      ]);
      setModal("reveal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string, keyName: string) {
    if (!window.confirm(`Revoke “${keyName}”? Any agent using this key will immediately lose access. This cannot be undone.`)) return;
    const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (res.ok) setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  return (
    <div className="content" style={{ padding: "32px 44px", position: "relative", overflow: dim ? "hidden" : "auto" }}>
      <div style={{ maxWidth: 920, margin: "0 auto", opacity: dim ? 0.4 : 1 }}>
        <SettingsHeader
          title="API keys"
          sub="Each key lets one agent read approved context and write in this workspace. What a key may do is set per key below; whether a change needs review also depends on the space's policy."
          action={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* A failed scope toggle happens outside the modal, so the
                  message has to live here rather than only inside it. */}
              {error && !dim && (
                <span style={{ fontSize: 12.5, color: "#993C1D" }}>{error}</span>
              )}
              {canManage ? (
                <button className="btn btn-primary" onClick={openNew}>
                  <IconPlus size={14} sw={2} />
                  <span>New API key</span>
                </button>
              ) : null}
            </div>
          }
        />

        {/* Agent API base URL */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 22, overflow: "hidden" }}>
          <StatCell label="Active keys" value={String(keys.length)} />
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Agent API base URL</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-primary)", wordBreak: "break-all" }}>{agentBase}</span>
          </div>
        </div>

        {keys.length === 0 ? (
          <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 12, padding: "48px 32px", textAlign: "center", color: "var(--text-muted)", fontSize: 13.5, background: "var(--bg-card)" }}>
            No API keys yet. {canManage ? "Create one to connect Claude Code, Cursor, or any agent." : "Ask a workspace admin to create one."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {keys.map((k) => (
              <KeyRow
                key={k.id}
                k={k}
                canManage={canManage}
                scopeBusy={scopeBusy === k.id}
                onScopeToggle={(scope, next) =>
                  setScopes(
                    k,
                    next ? [...k.scopes, scope] : k.scopes.filter((s) => s !== scope),
                  )
                }
                onRevoke={() => revoke(k.id, k.name)}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 28, padding: "16px 20px", background: "var(--bg-sidebar)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ width: 28, height: 28, borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
            <IconBook size={14} />
          </span>
          <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Agents authenticate with <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, background: "var(--bg-card)", padding: "1px 6px", borderRadius: 4 }}>Authorization: Bearer aqli_…</code> against{" "}
            <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>{agentBase}</strong> to read approved context and submit drafts for review.
          </div>
          <span style={{ color: "var(--text-secondary)", display: "flex" }}><IconArrowUpRight size={14} /></span>
        </div>
      </div>

      {dim && (
        <>
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,20,18,0.32)", zIndex: 50 }} onClick={() => setModal(null)} />
          {modal === "new" && (
            <NewKeyModal
              name={name}
              setName={setName}
              scopes={newScopes}
              setScopes={setNewScopes}
              busy={busy}
              error={error}
              onCancel={() => setModal(null)}
              onCreate={createKey}
            />
          )}
          {modal === "reveal" && secret && (
            <RevealModal name={revealName} secret={secret} agentBase={agentBase} onClose={() => { setModal(null); setSecret(null); }} />
          )}
        </>
      )}
    </div>
  );
}

function KeyRow({
  k,
  canManage,
  scopeBusy,
  onScopeToggle,
  onRevoke,
}: {
  k: KeyRowData;
  canManage: boolean;
  scopeBusy: boolean;
  onScopeToggle: (scope: AgentScope, next: boolean) => void;
  onRevoke: () => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 180px 90px", gap: 16, alignItems: "center", padding: "18px 20px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
      <span style={{ width: 36, height: 36, borderRadius: 8, background: "var(--agent-tint)", border: "1px solid var(--agent-border)", color: "var(--agent-icon)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IconRobot size={18} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{k.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--text-muted)" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{k.key_prefix}</span>
          <span>·</span>
          <span>Created {fmtDate(k.created_at)}</span>
        </div>
        <ScopeChips
          scopes={k.scopes}
          editable={canManage}
          busy={scopeBusy}
          onToggle={onScopeToggle}
        />
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{fmtWhen(k.last_used_at)}</div>
      {canManage ? (
        <button className="btn btn-ghost btn-ghost-danger" style={{ justifySelf: "end" }} onClick={onRevoke}>
          <IconTrash size={13} />
          <span>Revoke</span>
        </button>
      ) : (
        <span />
      )}
    </div>
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

function NewKeyModal({
  name,
  setName,
  scopes,
  setScopes,
  busy,
  error,
  onCancel,
  onCreate,
}: {
  name: string;
  setName: (v: string) => void;
  scopes: AgentScope[];
  setScopes: (v: AgentScope[]) => void;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
    <div style={{ ...MODAL_SHELL, width: 480 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>Create API key</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>Generate a key for a new agent. You&apos;ll see the full key once.</p>
      </div>
      <FormField label="Name" hint="Pick something specific — agent + machine helps if a key needs to be revoked.">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
          placeholder="e.g. Claude Code · CI runner"
          style={{ height: 36, padding: "0 12px", background: "var(--bg-base)", border: "1px solid var(--accent)", boxShadow: "0 0 0 3px rgba(15,110,86,0.12)", borderRadius: 6, fontSize: 13.5, color: "var(--text-primary)", fontFamily: "inherit", outline: "none" }}
        />
      </FormField>
      <FormField
        label="What this agent may do"
        hint="Every key can read approved context. Without “write directly”, an agent's changes wait in the review queue."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
          {SCOPE_OPTIONS.map((opt) => {
            const on = scopes.includes(opt.value);
            return (
              <label
                key={opt.value}
                style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setScopes(
                      on
                        ? scopes.filter((s) => s !== opt.value)
                        : [...scopes, opt.value],
                    )
                  }
                  style={{ marginTop: 2, accentColor: "var(--accent)" }}
                />
                <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.45 }}>
                    {opt.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </FormField>
      {error && <p style={{ margin: 0, fontSize: 13, color: "#993C1D" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={onCreate} disabled={busy || !name.trim()}>
          <IconKey size={13} /><span>{busy ? "Creating…" : "Create key"}</span>
        </button>
      </div>
    </div>
  );
}

function RevealModal({ name, secret, agentBase, onClose }: { name: string; secret: string; agentBase: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div style={{ ...MODAL_SHELL, width: 540 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--review-bg)", border: "1px solid var(--review-border)", borderRadius: 8 }}>
        <span style={{ color: "var(--review-text)", display: "flex" }}><IconWarn size={18} /></span>
        <div style={{ flex: 1, fontSize: 13, color: "var(--review-text)", lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 600 }}>Save this key now.</strong> This is the only time the full key will be shown. Store it in your password manager or secrets vault.
        </div>
      </div>
      <Label>{name}</Label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-primary)", wordBreak: "break-all" }}>
          {secret}
        </div>
        <button className="btn btn-secondary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <Label>Quick test</Label>
      <CodeBlock
        value={[
          `curl ${agentBase}/context \\`,
          `  -H "Authorization: Bearer ${secret.slice(0, 16)}…" \\`,
          '  -G --data-urlencode "query=payout retry"',
        ]}
      />
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Add this key as <code style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, background: "var(--bg-sidebar)", padding: "1px 6px", borderRadius: 4, color: "var(--text-secondary)" }}>AQLI_API_KEY</code> in your agent&apos;s environment.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
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

function CodeBlock({ value }: { value: string[] }) {
  return (
    <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre", overflow: "auto" }}>
      {value.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

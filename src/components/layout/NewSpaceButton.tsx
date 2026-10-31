"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconX } from "@/components/aqli/icons";
import SpaceIcon, { SPACE_ICON_KEYS, type SpaceIconKey } from "@/components/aqli/SpaceIcon";

export async function createSpaceRequest(workspaceId: string, name: string, icon: SpaceIconKey): Promise<string | null> {
  try {
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, name: name.trim(), icon }),
    });
    if (res.ok) return null;
    const body = await res.json().catch(() => null);
    return (res.status === 400 || res.status === 409) && typeof body?.error === "string"
      ? body.error
      : "Couldn't create the space. Try again.";
  } catch {
    return "Couldn't reach the server. Try again.";
  }
}

export default function NewSpaceButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<SpaceIconKey>("folder");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function create() {
    if (!name.trim() || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const failure = await createSpaceRequest(workspaceId, name, icon);
      if (failure) {
        setError(failure);
        return;
      }
      setOpen(false);
      setName("");
      setIcon("folder");
      router.refresh();
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setError(null); setOpen(true); }} className="sb-newspace" aria-label="New Space" title="New Space">
        <span className="sb-icon"><IconPlus size={14} /></span>
        <span>New Space</span>
      </button>

      {open && (
        <div className="aqli-overlay" onClick={() => { if (!busy) setOpen(false); }}>
          <form
            className="aqli-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create a space"
            aria-busy={busy}
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); void create(); }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                if (!busy) setOpen(false);
              }
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Create a space</h2>
              <button type="button" className="iconbtn" disabled={busy} onClick={() => setOpen(false)} aria-label="Close"><IconX size={16} /></button>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>Space name</span>
                <input
                  autoFocus
                  disabled={busy}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marketing"
                  aria-invalid={Boolean(error)}
                  style={{ height: 42, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-sans)", outline: "none" }}
                />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>Icon</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SPACE_ICON_KEYS.map((k) => (
                    <button
                      type="button"
                      key={k}
                      disabled={busy}
                      onClick={() => setIcon(k)}
                      aria-label={k}
                      aria-pressed={icon === k}
                      style={{
                        width: 38, height: 38, borderRadius: 8, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: `1.5px solid ${icon === k ? "var(--accent)" : "var(--border)"}`,
                        background: icon === k ? "var(--accent-light)" : "var(--bg-card)",
                        color: icon === k ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      <SpaceIcon icon={k} size={18} />
                    </button>
                  ))}
                </div>
              </div>
              {error && <p role="alert" style={{ margin: 0, fontSize: 13, color: "var(--danger-text)" }}>{error}</p>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 22px", borderTop: "1px solid var(--border)" }}>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create space"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

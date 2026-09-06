"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconX } from "@/components/aqli/icons";

const EMOJI_CHOICES = ["📋", "⚙️", "🛡️", "🔧", "🏢", "📐", "🚀", "📊", "🧪", "📁"];

export default function NewSpaceButton({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📋");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, name, icon }),
      });
      if (res.ok) {
        setOpen(false);
        setName("");
        setIcon("📋");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="sb-newspace">
        <span className="sb-icon"><IconPlus size={14} /></span>
        <span>New Space</span>
      </button>

      {open && (
        <div className="aqli-overlay" onClick={() => setOpen(false)}>
          <div className="aqli-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border)" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Create a space</h2>
              <button className="iconbtn" onClick={() => setOpen(false)} aria-label="Close"><IconX size={16} /></button>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>Space name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Marketing"
                  onKeyDown={(e) => e.key === "Enter" && create()}
                  style={{ height: 42, padding: "0 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-card)", fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-sans)", outline: "none" }}
                />
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>Icon</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {EMOJI_CHOICES.map((e) => (
                    <button
                      key={e}
                      onClick={() => setIcon(e)}
                      style={{
                        width: 38, height: 38, fontSize: 18, borderRadius: 8, cursor: "pointer",
                        border: `1.5px solid ${icon === e ? "var(--accent)" : "var(--border)"}`,
                        background: icon === e ? "var(--accent-light)" : "var(--bg-card)",
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 22px", borderTop: "1px solid var(--border)" }}>
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={create} disabled={busy || !name.trim()}>
                {busy ? "Creating…" : "Create space"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

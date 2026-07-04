"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The single policy switch from design 25b: auto-approve merged-PR docs
 * (default) vs. route them to the review queue. Admin-gated server-side.
 */
export default function AutoApprovePolicyToggle({
  workspaceId,
  enabled,
}: {
  workspaceId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/composio/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, auto_approve: !enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to update policy");
        return;
      }
      router.refresh();
    } catch {
      setError("Failed to update policy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Auto-approve docs from merged PRs"
        onClick={toggle}
        disabled={busy}
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          border: "1px solid var(--border-strong)",
          background: enabled ? "var(--accent)" : "var(--bg-sidebar)",
          position: "relative",
          cursor: busy ? "wait" : "pointer",
          padding: 0,
          transition: "background 120ms ease",
          flex: "0 0 auto",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 18 : 2,
            width: 14,
            height: 14,
            borderRadius: 999,
            background: "#fff",
            boxShadow: "0 1px 2px rgba(20,20,18,0.25)",
            transition: "left 120ms ease",
          }}
        />
      </button>
      <span style={{ fontSize: 12.5, color: enabled ? "var(--approved-text)" : "var(--review-text)", fontWeight: 500 }}>
        {busy ? "Saving…" : enabled ? "On — merged PRs publish directly" : "Off — merged PRs go to review"}
      </span>
      {error && <span style={{ fontSize: 12, color: "#993C1D" }}>{error}</span>}
    </div>
  );
}

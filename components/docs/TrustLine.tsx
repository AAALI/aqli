"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheckCircle, IconWarn, IconHistory } from "@/components/aqli/icons";
import { formatRelative } from "@/lib/utils";

/**
 * Woven maintenance: the freshness line under the title. Reading and
 * re-verifying live on the same surface, so "is this still true?" never
 * requires a trip to a separate dashboard.
 */
export default function TrustLine({
  docId,
  lastReviewedAt,
  reviewerName,
  stale,
}: {
  docId: string;
  lastReviewedAt: string | null;
  reviewerName: string | null;
  /** Computed on the server (>90d since verification, or never). */
  stale: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reverify() {
    setBusy(true);
    try {
      await fetch(`/api/docs/${docId}/reviewed`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 12,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12.5,
        color: "var(--text-muted)",
        padding: "8px 12px",
        background: "var(--bg-sidebar)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}
    >
      <span style={{ color: stale ? "var(--stale-text)" : "var(--approved-text)", display: "inline-flex" }}>
        {stale ? <IconWarn size={14} /> : <IconCheckCircle size={14} sw={1.8} />}
      </span>
      <span>
        {lastReviewedAt ? (
          <>
            Last verified{" "}
            <span style={{ color: "var(--text-secondary)" }}>
              {formatRelative(lastReviewedAt)}
            </span>
            {reviewerName ? ` by ${reviewerName}` : ""}
          </>
        ) : (
          "Not verified yet — confirm this is still accurate."
        )}
      </span>
      <button
        onClick={reverify}
        disabled={busy}
        className="btn btn-ghost"
        style={{ marginLeft: "auto", height: 24, fontSize: 11.5, padding: "0 8px", gap: 5 }}
      >
        <IconHistory size={11} />
        {busy ? "Verifying…" : "Re-verify"}
      </button>
    </div>
  );
}

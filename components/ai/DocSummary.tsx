"use client";

import { useState } from "react";
import { IconSparkle } from "@/components/aqli/icons";

export default function DocSummary({ docId }: { docId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: docId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setSummary(data.summary);
    } catch {
      setError("Failed to generate summary. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          AI summary
        </span>
        <button
          onClick={generate}
          disabled={loading}
          className="btn btn-ghost"
          style={{ gap: 5, height: 24, padding: "0 8px", fontSize: 11.5, color: "var(--accent)" }}
        >
          {!loading && !summary && <IconSparkle size={12} />}
          <span>{loading ? "Generating…" : summary ? "Regenerate" : "Summarise"}</span>
        </button>
      </div>

      {summary && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>
          {summary}
        </p>
      )}
      {error && (
        <p style={{ margin: 0, fontSize: 12.5, color: "#993C1D" }}>{error}</p>
      )}
      {!summary && !loading && !error && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Generate a plain-English summary of this doc with GPT-4o-mini.
        </p>
      )}
    </div>
  );
}

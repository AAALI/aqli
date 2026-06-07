"use client";

import { useEffect, useState } from "react";
import { parseLinearUrl, type LinearPreview } from "@/lib/integrations/linear";
import { IconArrowUpRight } from "@/components/aqli/icons";

export default function LinearPreviewPanel({ url }: { url: string }) {
  const parsed = parseLinearUrl(url);
  const [preview, setPreview] = useState<LinearPreview | null>(null);
  const [loading, setLoading] = useState(Boolean(parsed));

  useEffect(() => {
    if (!parsed) return;
    let active = true;
    fetch(`/api/integrations/linear?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) setPreview(d.preview ?? null);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (!parsed) return null;

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
          Linked Linear
        </span>
      </div>
      <a href={url} target="_blank" rel="noreferrer" style={{ display: "flex", flexDirection: "column", gap: 4, textDecoration: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {loading ? "Loading…" : preview ? preview.title : parsed.type === "issue" ? "Linear issue" : "Linear project"}
          </span>
          <span style={{ color: "var(--text-muted)" }}><IconArrowUpRight size={13} /></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--text-muted)" }}>
          <span style={{ textTransform: "capitalize" }}>{parsed.type}</span>
          {preview && (
            <>
              <span>·</span>
              <span style={{ color: "var(--review-text)", fontWeight: 500 }}>{preview.status}</span>
            </>
          )}
          {!preview && !loading && <span>· open in Linear</span>}
        </div>
      </a>
    </div>
  );
}

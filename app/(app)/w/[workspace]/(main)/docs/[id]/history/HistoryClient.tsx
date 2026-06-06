"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import AppTopBar from "@/components/layout/AppTopBar";
import { IconHistory, IconRobot } from "@/components/aqli/icons";
import { markdownToTiptap } from "@/lib/markdown/md-to-tiptap";
import { formatRelative, formatDate } from "@/lib/utils";

type V = {
  id: string;
  version_number: number;
  change_type: string;
  created_at: string;
  body_md: string;
};

type DiffRow = { type: "ctx" | "add" | "remove"; text: string };

function diffLines(a: string[], b: string[]): DiffRow[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "ctx", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "remove", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "remove", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}

const CHANGE_LABEL: Record<string, string> = {
  created: "Created",
  edit: "Edited",
  status_change: "Status changed",
};

export default function HistoryClient({
  workspaceSlug,
  docId,
  docTitle,
  spaceName,
  spaceSlug,
  versions,
}: {
  workspaceSlug: string;
  docId: string;
  docTitle: string;
  spaceName: string | null;
  spaceSlug: string | null;
  versions: V[];
}) {
  const router = useRouter();
  const base = `/w/${workspaceSlug}`;
  const [selectedId, setSelectedId] = useState<string | null>(versions[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  const selectedIdx = versions.findIndex((v) => v.id === selectedId);
  const selected = selectedIdx >= 0 ? versions[selectedIdx] : null;
  // Predecessor = the next-older version (versions are sorted newest-first)
  const previous = selectedIdx >= 0 ? versions[selectedIdx + 1] : undefined;

  const rows = useMemo(() => {
    if (!selected) return [];
    const a = (previous?.body_md ?? "").split("\n");
    const b = selected.body_md.split("\n");
    return diffLines(a, b);
  }, [selected, previous]);

  const added = rows.filter((r) => r.type === "add").length;
  const removed = rows.filter((r) => r.type === "remove").length;
  const isCurrent = selectedIdx === 0;

  async function restore() {
    if (!selected) return;
    setBusy(true);
    try {
      await fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body_md: selected.body_md,
          body_json: markdownToTiptap(selected.body_md),
        }),
      });
      router.push(`${base}/docs/${docId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const crumbs = spaceSlug
    ? [
        { label: spaceName ?? "Space", href: `${base}/s/${spaceSlug}` },
        { label: docTitle, href: `${base}/docs/${docId}` },
        { label: "Version history" },
      ]
    : [{ label: docTitle, href: `${base}/docs/${docId}` }, { label: "Version history" }];

  return (
    <>
      <AppTopBar base={base} crumbs={crumbs} />

      {/* Doc context bar */}
      <div style={{ flex: "0 0 56px", height: 56, padding: "0 32px", borderBottom: "1px solid var(--border)", background: "var(--bg-base)", display: "flex", alignItems: "center", gap: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 20, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
          {docTitle}
        </h2>
        <span style={{ color: "var(--border-strong)" }}>|</span>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
          {versions.length} version{versions.length === 1 ? "" : "s"}
        </span>
        <div style={{ flex: 1 }} />
        {selected && (
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            {previous ? (
              <>Comparing <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>v{previous.version_number}</strong> → <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>v{selected.version_number}</strong></>
            ) : (
              <>Showing <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>v{selected.version_number}</strong> (initial)</>
            )}
          </span>
        )}
      </div>

      <div className="main-body">
        {/* Timeline */}
        <aside style={{ width: 340, flex: "0 0 340px", borderRight: "1px solid var(--border)", background: "var(--bg-card)", overflow: "auto", padding: "20px 0 0" }}>
          <div style={{ padding: "0 20px 12px", fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Timeline
          </div>
          {versions.length === 0 ? (
            <div style={{ padding: "0 20px", fontSize: 13, color: "var(--text-muted)" }}>
              No version snapshots yet. Versions are captured on status changes and edits.
            </div>
          ) : (
            <div style={{ position: "relative", padding: "0 0 24px 0" }}>
              <div style={{ position: "absolute", left: 36, top: 8, bottom: 36, width: 1, background: "var(--border)" }} />
              {versions.map((v, i) => {
                const sel = v.id === selectedId;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedId(v.id)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 1fr",
                      gap: 14,
                      alignItems: "start",
                      padding: "10px 20px 10px 0",
                      width: "100%",
                      textAlign: "left",
                      background: sel ? "var(--bg-sidebar)" : "transparent",
                      borderRight: `2px solid ${sel ? "var(--accent)" : "transparent"}`,
                      border: "none",
                      borderLeft: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    <div style={{ position: "relative", display: "flex", justifyContent: "center", paddingTop: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: "var(--bg-card)", border: `2px solid ${i === 0 ? "var(--approved-text)" : "var(--text-muted)"}`, boxShadow: sel ? "0 0 0 4px rgba(15,110,86,0.15)" : "none", zIndex: 1 }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500 }}>v{v.version_number}</span>
                        {i === 0 && (
                          <span style={{ fontSize: 10, color: "var(--accent)", padding: "0 6px", height: 16, borderRadius: 3, background: "var(--accent-light)", border: "1px solid rgba(15,110,86,0.25)", display: "inline-flex", alignItems: "center", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
                            current
                          </span>
                        )}
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatRelative(v.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, letterSpacing: "-0.005em" }}>
                        {CHANGE_LABEL[v.change_type] ?? v.change_type}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{formatDate(v.created_at)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Diff */}
        <div style={{ flex: 1, overflow: "hidden", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
          {selected ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {previous && (
                  <>
                    <span style={{ padding: "4px 10px", borderRadius: 6, background: "var(--bg-sidebar)", border: "1px solid var(--border)", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                      v{previous.version_number}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>→</span>
                  </>
                )}
                <span style={{ padding: "4px 10px", borderRadius: 6, background: "var(--accent-light)", border: "1px solid rgba(15,110,86,0.25)", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 500 }}>
                  v{selected.version_number}{isCurrent ? " · current" : ""}
                </span>
                <div style={{ flex: 1 }} />
                <div style={{ display: "inline-flex", alignItems: "center", gap: 14, fontSize: 12 }}>
                  <span style={{ color: "var(--approved-text)", fontFamily: "var(--font-mono)" }}>+{added}</span>
                  <span style={{ color: "#993C1D", fontFamily: "var(--font-mono)" }}>−{removed}</span>
                </div>
                {!isCurrent && (
                  <button className="btn btn-secondary" style={{ marginLeft: 8 }} onClick={restore} disabled={busy}>
                    <IconHistory size={13} />
                    <span>{busy ? "Restoring…" : `Restore v${selected.version_number}`}</span>
                  </button>
                )}
              </div>

              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "auto", flex: 1, padding: "20px 24px", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.7, color: "var(--text-primary)" }}>
                {rows.length === 0 ? (
                  <div style={{ color: "var(--text-muted)" }}>No textual changes in this version.</div>
                ) : (
                  rows.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "1px 12px",
                        margin: "0 -12px",
                        background: r.type === "add" ? "rgba(15,110,86,0.08)" : r.type === "remove" ? "rgba(153,60,29,0.08)" : "transparent",
                        color: r.type === "add" ? "var(--approved-text)" : r.type === "remove" ? "#993C1D" : "var(--text-secondary)",
                        borderLeft: `3px solid ${r.type === "add" ? "var(--accent)" : r.type === "remove" ? "#993C1D" : "transparent"}`,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {(r.type === "add" ? "+ " : r.type === "remove" ? "- " : "  ") + (r.text || " ")}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <IconRobot size={16} /> No versions to compare yet.
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

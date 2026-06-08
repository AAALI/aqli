"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TypeBadge, AgentChip } from "@/components/aqli/badges";
import { IconArrowUpRight, IconCheck } from "@/components/aqli/icons";
import { typeLabel } from "@/lib/doc-display";
import { formatRelative } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

type Props = {
  docs: DocWithSpace[];
  workspaceId: string;
  workspaceSlug: string;
};

type Dialog = { type: "reject" | "changes"; docId: string } | null;

function previewOf(md: string | null): string {
  if (!md) return "";
  return md
    .replace(/^---[\s\S]*?---\n/, "") // strip frontmatter
    .replace(/#{1,6}\s/g, "") // strip heading markers
    .replace(/[*_`>]/g, "")
    .trim();
}

export default function ReviewQueueClient({ docs, workspaceId, workspaceSlug }: Props) {
  const router = useRouter();
  const base = `/w/${workspaceSlug}`;
  const [loading, setLoading] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  async function act(docId: string, action: string, extra?: Record<string, string>) {
    setLoading(docId);
    try {
      await fetch(`/api/review/${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, workspace_id: workspaceId, ...extra }),
      });
      router.refresh();
    } finally {
      setLoading(null);
      setDialog(null);
      setReason("");
      setNote("");
    }
  }

  if (docs.length === 0) {
    return (
      <div className="content" style={{ padding: "28px 40px" }}>
        <div
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: 280, color: "var(--text-muted)", gap: 8,
          }}
        >
          <span
            style={{
              width: 44, height: 44, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--approved-bg, var(--accent-light))", color: "var(--accent)", marginBottom: 4,
            }}
          >
            <IconCheck size={20} sw={2.2} />
          </span>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "var(--text-secondary)" }}>
            Review queue is clear
          </p>
          <p style={{ margin: 0, fontSize: 13 }}>No agent docs are waiting for review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content" style={{ padding: "28px 40px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.015em" }}>
          Review Queue
        </h1>
        <div style={{ marginTop: 4, fontSize: 13.5, color: "var(--text-secondary)" }}>
          {docs.length} {docs.length === 1 ? "doc" : "docs"} waiting for review
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 960 }}>
        {docs.map((doc) => {
          const preview = previewOf(doc.body_md);
          return (
            <div
              key={doc.id}
              className="card"
              style={{ overflow: "hidden", borderLeft: "3px solid var(--review-text)" }}
            >
              <div style={{ padding: "20px 24px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <AgentChip label={doc.author_type === "agent" ? "Agent authored" : "Human authored"} />
                      <TypeBadge type={typeLabel(doc.type)} />
                      {doc.space && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {doc.space.name}</span>
                      )}
                    </div>
                    <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>
                      <Link href={`${base}/docs/${doc.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {doc.title}
                      </Link>
                    </h3>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    {formatRelative(doc.updated_at)}
                  </span>
                </div>

                {preview && (
                  <p
                    style={{
                      margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)",
                      display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}
                  >
                    {preview}
                  </p>
                )}

                {doc.agent_id && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Written by <span style={{ fontFamily: "var(--font-mono)" }}>{doc.agent_id}</span>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                  <Link
                    href={`${base}/docs/${doc.id}`}
                    target="_blank"
                    className="btn btn-ghost"
                    style={{ gap: 5, marginRight: "auto", fontSize: 12.5 }}
                  >
                    <IconArrowUpRight size={13} />
                    <span>Read full doc</span>
                  </Link>

                  <button
                    onClick={() => act(doc.id, "approve")}
                    disabled={loading === doc.id}
                    className="btn btn-primary"
                  >
                    {loading === doc.id ? "Approving…" : "Approve"}
                  </button>
                  <button
                    onClick={() => setDialog({ type: "changes", docId: doc.id })}
                    disabled={loading === doc.id}
                    className="btn btn-secondary"
                  >
                    Request Changes
                  </button>
                  <button
                    onClick={() => setDialog({ type: "reject", docId: doc.id })}
                    disabled={loading === doc.id}
                    className="btn btn-ghost btn-ghost-danger"
                  >
                    Reject
                  </button>
                </div>
              </div>

              {dialog?.type === "reject" && dialog.docId === doc.id && (
                <div style={{ borderTop: "1px solid var(--border)", background: "var(--stale-bg)", padding: 16 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--stale-text)", marginBottom: 8 }}>
                    Reason for rejection
                  </div>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Explain why this doc is being rejected…"
                    rows={3}
                    style={inputStyle}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => act(doc.id, "reject", { reason })}
                      className="btn btn-ghost btn-ghost-danger"
                      style={{ background: "var(--stale-bg)" }}
                    >
                      Confirm Rejection
                    </button>
                    <button onClick={() => setDialog(null)} className="btn btn-ghost">Cancel</button>
                  </div>
                </div>
              )}

              {dialog?.type === "changes" && dialog.docId === doc.id && (
                <div style={{ borderTop: "1px solid var(--border)", background: "var(--review-bg)", padding: 16 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--review-text)", marginBottom: 8 }}>
                    What needs to change?
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Describe what the agent should update…"
                    rows={3}
                    style={inputStyle}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => act(doc.id, "request_changes", { note })} className="btn btn-secondary">
                      Send Feedback
                    </button>
                    <button onClick={() => setDialog(null)} className="btn btn-ghost">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 13.5,
  color: "var(--text-primary)",
  lineHeight: 1.55,
  fontFamily: "var(--font-sans)",
  outline: "none",
  resize: "vertical",
};

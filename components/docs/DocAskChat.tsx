"use client";

import { useEffect, useRef, useState } from "react";
import { IconChat, IconArrowUpRight, IconX } from "@/components/aqli/icons";

type Source = { doc_id: string; doc_title: string; heading: string | null; source_url: string };
type Turn = { role: "user" | "aqli"; text: string; sources?: Source[] };

/**
 * "Ask Aqli about this doc" — the reader's killer JTBD: a precise answer
 * without leaving the page. Floats over the doc as a pill that expands into a
 * chat. Questions are biased toward this doc; answers cite approved docs.
 */
export default function DocAskChat({
  workspaceId,
  docTitle,
}: {
  workspaceId: string;
  docTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `In the context of the doc "${docTitle}": ${q}`,
          workspace_id: workspaceId,
        }),
      });
      const data = await res.json();
      setTurns((t) => [
        ...t,
        { role: "aqli", text: data.answer ?? "Unable to answer.", sources: data.sources ?? [] },
      ]);
    } catch {
      setTurns((t) => [...t, { role: "aqli", text: "Something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          zIndex: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px 10px 12px",
          background: "var(--text-primary)",
          color: "#fff",
          border: 0,
          borderRadius: 999,
          boxShadow: "0 18px 36px -10px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.10)",
          cursor: "pointer",
          fontSize: 12.5,
          fontWeight: 500,
          fontFamily: "var(--font-sans)",
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "var(--accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconChat size={12} />
        </span>
        Ask about this doc
      </button>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 24,
        width: 360,
        maxHeight: "min(560px, calc(100% - 48px))",
        background: "var(--bg-card)",
        border: "1px solid var(--border-strong)",
        borderRadius: 14,
        boxShadow: "0 24px 48px -12px rgba(20,20,18,0.22), 0 4px 12px rgba(20,20,18,0.08)",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-base)",
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "var(--accent)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconChat size={12} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
            Ask about this doc
          </span>
          <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            Answers cite approved docs
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: 0,
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "inline-flex",
            padding: 4,
          }}
          title="Close"
        >
          <IconX size={14} />
        </button>
      </div>

      {/* Conversation */}
      <div
        ref={bodyRef}
        style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flex: 1 }}
      >
        {turns.length === 0 && !loading && (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            Ask anything about this doc — e.g. &ldquo;what changed in the latest
            version?&rdquo; Answers are drawn from approved docs.
          </div>
        )}
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "82%" }}>
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: "14px 14px 4px 14px",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {t.text}
              </div>
            </div>
          ) : (
            <div key={i} style={{ alignSelf: "flex-start", maxWidth: "92%" }}>
              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--bg-base)",
                  border: "1px solid var(--border)",
                  borderRadius: "14px 14px 14px 4px",
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {t.text}
                {t.sources && t.sources.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      fontSize: 10.5,
                      color: "var(--text-muted)",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ marginRight: 2 }}>Cited:</span>
                    {t.sources.map((s) => (
                      <a
                        key={`${s.doc_id}-${s.heading ?? ""}`}
                        href={s.source_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 11,
                          padding: "1px 6px",
                          background: "var(--bg-sidebar)",
                          borderRadius: 4,
                          border: "1px solid var(--border)",
                          color: "var(--text-secondary)",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <IconArrowUpRight size={10} />
                        {s.doc_title}
                        {s.heading ? ` · ${s.heading}` : ""}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {loading && (
          <div style={{ alignSelf: "flex-start", fontSize: 12.5, color: "var(--text-muted)" }}>
            Searching approved docs…
          </div>
        )}
      </div>

      {/* Composer */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-base)",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder="Ask a follow-up…"
          autoFocus
          style={{
            flex: 1,
            height: 30,
            padding: "0 10px",
            fontSize: 13,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            outline: "none",
            fontFamily: "var(--font-sans)",
          }}
        />
        <button
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          className="btn btn-primary"
          style={{ height: 30, padding: "0 12px", fontSize: 12.5 }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}

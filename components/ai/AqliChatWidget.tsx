"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChat, IconArrowUpRight, IconX } from "@/components/aqli/icons";

type Source = { doc_id: string; doc_title: string; heading: string | null };
type Turn = { role: "user" | "aqli"; text: string; sources?: Source[] };

/**
 * Ask Aqli — the workspace-wide Q&A chat. Mounted once in the workspace
 * layout so it floats on every page (home, spaces, search, settings, docs)
 * and the conversation survives navigation. On doc pages the question is
 * biased toward the doc being read; answers always cite approved docs.
 */
export default function AqliChatWidget({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  // The doc the user dismissed scoping for — scoping re-enables on the next doc.
  const [scopeOffDocId, setScopeOffDocId] = useState<string | null>(null);
  const [docTitles, setDocTitles] = useState<Record<string, string>>({});
  const bodyRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const docMatch = pathname?.match(
    new RegExp(`^/w/${workspaceSlug}/docs/([^/]+)`),
  );
  const docId = docMatch?.[1] ?? null;
  const docTitle = docId ? docTitles[docId] : undefined;

  useEffect(() => {
    if (!open || !docId || docTitles[docId] !== undefined) return;
    let cancelled = false;
    fetch(`/api/docs/${docId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const title = data?.doc?.title;
        setDocTitles((t) => ({ ...t, [docId]: typeof title === "string" ? title : "" }));
      })
      .catch(() => {
        if (!cancelled) setDocTitles((t) => ({ ...t, [docId]: "" }));
      });
    return () => {
      cancelled = true;
    };
  }, [open, docId, docTitles]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading, open]);

  const scopedToDoc = Boolean(docId && docTitle && scopeOffDocId !== docId);

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
          question: scopedToDoc
            ? `In the context of the doc "${docTitle}": ${q}`
            : q,
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
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 100,
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
        Ask Aqli
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 360,
        maxHeight: "min(560px, calc(100vh - 48px))",
        background: "var(--bg-card)",
        border: "1px solid var(--border-strong)",
        borderRadius: 14,
        boxShadow: "0 24px 48px -12px rgba(20,20,18,0.22), 0 4px 12px rgba(20,20,18,0.08)",
        zIndex: 100,
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
            Ask Aqli
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
            Ask anything about this workspace&rsquo;s knowledge — e.g. &ldquo;how
            does our auth flow work?&rdquo; Answers are drawn from approved docs.
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
                      <Link
                        key={`${s.doc_id}-${s.heading ?? ""}`}
                        href={`/w/${workspaceSlug}/docs/${s.doc_id}`}
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
                      </Link>
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

      {/* Doc scope chip — questions are biased toward the doc being read */}
      {scopedToDoc && (
        <div
          style={{
            padding: "6px 12px 0",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--bg-base)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10.5,
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--accent-light, var(--bg-sidebar))",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              maxWidth: "100%",
              minWidth: 0,
            }}
          >
            <span style={{ whiteSpace: "nowrap" }}>Asking about:</span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontWeight: 500,
              }}
            >
              {docTitle}
            </span>
            <button
              onClick={() => setScopeOffDocId(docId)}
              title="Ask the whole workspace instead"
              style={{
                background: "transparent",
                border: 0,
                padding: 0,
                cursor: "pointer",
                color: "var(--text-muted)",
                display: "inline-flex",
              }}
            >
              <IconX size={10} />
            </button>
          </span>
        </div>
      )}

      {/* Composer */}
      <div
        style={{
          padding: "10px 12px",
          borderTop: scopedToDoc ? 0 : "1px solid var(--border)",
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
          placeholder={turns.length ? "Ask a follow-up…" : "Ask a question…"}
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

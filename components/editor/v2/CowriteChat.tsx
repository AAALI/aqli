"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  IconCheck,
  IconWand,
} from "@/components/aqli/icons";
import { markdownToTiptap } from "@/lib/markdown/md-to-tiptap";
import { tiptapToMarkdown } from "@/lib/markdown/tiptap-to-md";
import type { CowriteMessage } from "./types";

/** Strip the trailing "> Note: …" meta-comment before inserting a draft. */
function insertableMarkdown(md: string): string {
  return md
    .split("\n")
    .filter((line) => !/^>\s*Note:/i.test(line.trim()))
    .join("\n")
    .trim();
}

export default function CowriteChat({
  open,
  onToggle,
  editor,
  workspaceId,
  docId,
  docTitle,
  base,
  prefill,
  onPrefillConsumed,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
  editor: Editor;
  workspaceId: string;
  docId: string;
  docTitle: string;
  base: string;
  prefill: string | null;
  onPrefillConsumed: () => void;
}) {
  const [messages, setMessages] = useState<CowriteMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && prefill) {
      const timer = window.setTimeout(() => {
        setInput(prefill);
        onPrefillConsumed();
        inputRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [open, prefill, onPrefillConsumed]);

  useEffect(() => {
    if (open) {
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
    }
  }, [open, messages.length, busy]);

  const send = useCallback(
    async (history: CowriteMessage[]) => {
      setBusy(true);
      try {
        const res = await fetch("/api/ai/cowrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            doc_id: docId,
            title: docTitle,
            body_md: tiptapToMarkdown(editor.getJSON() as Record<string, unknown>),
            messages: history.map(({ role, content }) => ({ role, content })),
          }),
        });
        const data = await res.json();
        setMessages([
          ...history,
          {
            role: "assistant",
            content:
              typeof data.reply === "string" && data.reply
                ? data.reply
                : "Something went wrong — try again.",
            sources: data.sources ?? [],
          },
        ]);
      } catch {
        setMessages([
          ...history,
          { role: "assistant", content: "Something went wrong — try again." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [editor, workspaceId, docId, docTitle],
  );

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text || busy) return;
    const history: CowriteMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    void send(history);
  }, [input, busy, messages, send]);

  const regenerate = useCallback(() => {
    if (busy) return;
    const history = [...messages];
    if (history[history.length - 1]?.role === "assistant") history.pop();
    if (history.length === 0) return;
    setMessages(history);
    void send(history);
  }, [busy, messages, send]);

  const insert = useCallback(
    (md: string) => {
      const content = markdownToTiptap(insertableMarkdown(md)).content ?? [];
      if (content.length === 0) return;
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.selection.to, content)
        .run();
    },
    [editor],
  );

  if (!open) {
    return (
      <div
        onClick={() => onToggle(true)}
        style={{
          position: "absolute",
          bottom: 24,
          right: 304, // clear of the 280px rail
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px 10px 12px",
          background: "var(--text-primary)",
          color: "var(--bg-card)",
          borderRadius: 999,
          boxShadow: "0 18px 36px -10px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.10)",
          cursor: "pointer",
          zIndex: 20,
          fontSize: 12.5,
          fontWeight: 500,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "var(--accent)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <IconWand size={12} />
        </span>
        <span>Co-write</span>
        <kbd
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            opacity: 0.62,
            padding: "0 5px",
            border: "1px solid currentColor",
            borderRadius: 3,
            marginLeft: 4,
          }}
        >
          ⌘J
        </kbd>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 304,
        width: 360,
        background: "var(--bg-card)",
        border: "1px solid var(--border-strong)",
        borderRadius: 14,
        boxShadow: "0 24px 48px -12px rgba(20,20,18,0.22), 0 4px 12px rgba(20,20,18,0.08)",
        zIndex: 20,
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
          <IconWand size={12} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
            Co-write
          </span>
          <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
            Drafts inline · you approve every change
          </span>
        </div>
        <button
          onClick={() => onToggle(false)}
          title="Collapse (⌘J)"
          style={{
            marginLeft: "auto",
            cursor: "pointer",
            padding: 4,
            fontSize: 16,
            lineHeight: "12px",
            color: "var(--text-muted)",
            background: "transparent",
            border: 0,
          }}
        >
          −
        </button>
      </div>

      {/* Conversation */}
      <div
        ref={bodyRef}
        style={{
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxHeight: 360,
          minHeight: 120,
          overflowY: "auto",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "92%",
              padding: "10px 12px",
              background: "var(--accent-light)",
              border: "1px solid rgba(15,110,86,0.20)",
              borderRadius: "14px 14px 14px 4px",
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--text-primary)",
            }}
          >
            I can draft sections, tighten prose, or cite approved docs from this
            workspace. Try <strong>&ldquo;Draft the rollout plan section.&rdquo;</strong>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} style={{ alignSelf: "flex-end", maxWidth: "82%" }}>
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: "14px 14px 4px 14px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
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
                  overflowWrap: "break-word",
                }}
              >
                {m.content}
                {m.sources && m.sources.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      fontSize: 10.5,
                      color: "var(--text-muted)",
                    }}
                  >
                    <span style={{ marginRight: 2 }}>From:</span>
                    {m.sources.map((s) => (
                      <a
                        key={s.doc_id + (s.heading ?? "")}
                        href={`${base}/docs/${s.doc_id}`}
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
                        }}
                      >
                        {s.doc_title}
                      </a>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                  <button
                    className="btn btn-primary"
                    style={{ height: 24, fontSize: 11.5, padding: "0 10px" }}
                    onClick={() => insert(m.content)}
                  >
                    <IconCheck size={10} /> Insert at cursor
                  </button>
                  {i === messages.length - 1 && (
                    <button
                      className="btn btn-ghost"
                      style={{ height: 24, fontSize: 11.5, padding: "0 8px", color: "var(--text-muted)" }}
                      onClick={regenerate}
                    >
                      Regenerate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ),
        )}

        {busy && (
          <div style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--text-muted)" }}>
            Co-write is thinking…
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
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask Co-write to draft, tighten, or cite…"
          style={{
            flex: 1,
            fontSize: 13,
            background: "transparent",
            border: 0,
            outline: "none",
            color: "var(--text-primary)",
            fontFamily: "var(--font-sans)",
          }}
        />
        <kbd
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
            padding: "1px 5px",
            border: "1px solid var(--border)",
            borderRadius: 3,
          }}
        >
          ↵
        </kbd>
      </div>
    </div>
  );
}

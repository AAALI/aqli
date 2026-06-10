"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  IconCheckCircle,
  IconLink,
  IconQuote,
  IconSparkle,
  IconWarn,
} from "@/components/aqli/icons";
import type { RelatedResult } from "./types";

type OutlineItem = { level: number; text: string; pos: number; current: boolean };
type Hint = { level: "ok" | "warn"; text: string };

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </div>
  );
}

export default function EditorRail({
  editor,
  docTitle,
  workspaceId,
  docId,
  base,
}: {
  editor: Editor;
  docTitle: string;
  workspaceId: string;
  docId: string;
  base: string;
}) {
  return (
    <aside
      style={{
        width: 280,
        flex: "0 0 280px",
        borderLeft: "1px solid var(--border)",
        background: "var(--bg-card)",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <OutlineSection editor={editor} docTitle={docTitle} />
      <div style={{ borderTop: "1px solid var(--border)" }} />
      <RelatedSection editor={editor} workspaceId={workspaceId} docId={docId} base={base} />
      <div style={{ borderTop: "1px solid var(--border)" }} />
      <ConsistencySection editor={editor} docTitle={docTitle} workspaceId={workspaceId} docId={docId} />
    </aside>
  );
}

// ── Outline ──────────────────────────────────────────────────────────

function OutlineSection({ editor, docTitle }: { editor: Editor; docTitle: string }) {
  const [items, setItems] = useState<OutlineItem[]>([]);

  useEffect(() => {
    const recompute = () => {
      const headings: { level: number; text: string; pos: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          headings.push({
            level: Number(node.attrs.level ?? 2),
            text: node.textContent || "Untitled section",
            pos,
          });
        }
      });
      const cursor = editor.state.selection.from;
      let currentIdx = -1;
      headings.forEach((h, i) => {
        if (h.pos <= cursor) currentIdx = i;
      });
      setItems(headings.map((h, i) => ({ ...h, current: i === currentIdx })));
    };
    recompute();
    editor.on("update", recompute);
    editor.on("selectionUpdate", recompute);
    return () => {
      editor.off("update", recompute);
      editor.off("selectionUpdate", recompute);
    };
  }, [editor]);

  const jump = useCallback(
    (pos: number) => {
      editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
    },
    [editor],
  );

  return (
    <div style={{ padding: "20px 20px 14px" }}>
      <RailLabel>On this doc</RailLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 8 }}>
        <div
          style={{
            padding: "4px 8px",
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {docTitle || "Untitled"}
        </div>
        {items.length === 0 ? (
          <div style={{ padding: "4px 8px 4px 18px", fontSize: 12.5, color: "var(--text-muted)" }}>
            Add headings to build the outline.
          </div>
        ) : (
          items.map((o, i) => (
            <div
              key={`${o.pos}-${i}`}
              onClick={() => jump(o.pos)}
              style={{
                padding: "4px 8px",
                paddingLeft: 10 + (o.level - 1) * 10,
                fontSize: 13,
                fontWeight: o.current ? 500 : 400,
                color: o.current ? "var(--accent)" : "var(--text-primary)",
                background: o.current ? "var(--accent-light)" : "transparent",
                borderRadius: 5,
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {o.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Related context — approved passages matching the draft ──────────

function RelatedSection({
  editor,
  workspaceId,
  docId,
  base,
}: {
  editor: Editor;
  workspaceId: string;
  docId: string;
  base: string;
}) {
  const [cards, setCards] = useState<RelatedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const lastQuery = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const { from } = editor.state.selection;
        const size = editor.state.doc.content.size;
        const text = editor.state.doc
          .textBetween(Math.max(0, from - 700), Math.min(size, from + 300), "\n")
          .trim();
        if (text.length < 60 || text === lastQuery.current) return;
        lastQuery.current = text;
        setLoading(true);
        try {
          const res = await fetch("/api/ai/related", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspace_id: workspaceId, doc_id: docId, text }),
          });
          const data = await res.json();
          setCards(data.results ?? []);
        } catch {
          // Keep the previous cards on a transient failure.
        } finally {
          setLoading(false);
        }
      }, 1800);
    };
    schedule(); // initial pass over existing content
    editor.on("update", schedule);
    return () => {
      editor.off("update", schedule);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editor, workspaceId, docId]);

  const insertQuote = useCallback(
    (r: RelatedResult) => {
      const href = `${base}/docs/${r.doc_id}`;
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.selection.to, [
          {
            type: "blockquote",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: `${r.excerpt.replace(/…$/, "")} ` },
                  {
                    type: "text",
                    text: `— ${r.doc_title}`,
                    marks: [{ type: "link", attrs: { href } }],
                  },
                ],
              },
            ],
          },
        ])
        .run();
    },
    [editor, base],
  );

  const insertCite = useCallback(
    (r: RelatedResult) => {
      editor
        .chain()
        .focus()
        .insertContentAt(editor.state.selection.to, [
          {
            type: "text",
            text: r.doc_title,
            marks: [{ type: "link", attrs: { href: `${base}/docs/${r.doc_id}` } }],
          },
          { type: "text", text: " " },
        ])
        .run();
    },
    [editor, base],
  );

  return (
    <div style={{ padding: "16px 20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <RailLabel>Related context</RailLabel>
        <span style={{ color: "var(--accent)", display: "flex" }}>
          <IconSparkle size={12} />
        </span>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--text-muted)",
          lineHeight: 1.45,
          marginBottom: 12,
        }}
      >
        Approved sections that line up with what you&apos;re writing.
      </div>

      {cards.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {loading
            ? "Searching approved docs…"
            : "Nothing yet — matches appear as you write."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: loading ? 0.6 : 1 }}>
          {cards.map((r) => (
            <div
              key={r.doc_id + (r.heading ?? "")}
              style={{
                padding: "10px 12px",
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <a
                href={`${base}/docs/${r.doc_id}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: 13,
                  lineHeight: 1.3,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.005em",
                  textDecoration: "none",
                }}
              >
                {r.heading ? `§ ${r.heading}` : r.doc_title}
              </a>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{r.doc_title}</span>
                <span>·</span>
                <span style={{ color: "var(--approved-text)" }}>Approved</span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--text-secondary)",
                  borderLeft: "2px solid var(--border-strong)",
                  paddingLeft: 8,
                }}
              >
                {r.excerpt}
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 2 }}>
                <MiniBtn icon={<IconQuote size={11} />} label="Quote" onClick={() => insertQuote(r)} />
                <MiniBtn icon={<IconLink size={11} />} label="Cite" onClick={() => insertCite(r)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBtn({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 22,
        padding: "0 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Consistency check ────────────────────────────────────────────────

function ConsistencySection({
  editor,
  docTitle,
  workspaceId,
  docId,
}: {
  editor: Editor;
  docTitle: string;
  workspaceId: string;
  docId: string;
}) {
  const [hints, setHints] = useState<Hint[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const { tiptapToMarkdown } = await import("@/lib/markdown/tiptap-to-md");
      const res = await fetch("/api/ai/consistency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          doc_id: docId,
          title: docTitle,
          body_md: tiptapToMarkdown(editor.getJSON() as Record<string, unknown>),
        }),
      });
      const data = await res.json();
      setHints(data.hints ?? []);
    } catch {
      setHints([]);
    } finally {
      setRunning(false);
    }
  }, [editor, workspaceId, docId, docTitle]);

  return (
    <div style={{ padding: "16px 20px 24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <RailLabel>Consistency check</RailLabel>
        <button
          onClick={run}
          disabled={running}
          style={{
            background: "transparent",
            border: 0,
            padding: 0,
            fontSize: 11.5,
            fontWeight: 500,
            color: "var(--accent)",
            cursor: running ? "default" : "pointer",
            fontFamily: "var(--font-sans)",
            opacity: running ? 0.6 : 1,
          }}
        >
          {running ? "Checking…" : hints === null ? "Run" : "Re-run"}
        </button>
      </div>

      {hints === null ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Checks terminology, missing sections, and voice against approved docs.
        </div>
      ) : hints.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {running ? "Checking…" : "No hints — write a bit more and re-run."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {hints.map((h, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "16px 1fr",
                gap: 8,
                fontSize: 12.5,
                lineHeight: 1.5,
                color: "var(--text-secondary)",
              }}
            >
              <span
                style={{
                  color: h.level === "ok" ? "var(--approved-text)" : "var(--review-text)",
                  marginTop: 2,
                }}
              >
                {h.level === "ok" ? <IconCheckCircle size={14} sw={1.8} /> : <IconWarn size={14} />}
              </span>
              <span>{h.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

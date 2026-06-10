"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Editor } from "@tiptap/react";
import { markdownToTiptap } from "@/lib/markdown/md-to-tiptap";
import type { KeyHandlerRegistry, RelatedResult } from "./types";

type RewriteAction = "tighten" | "expand" | "match_voice";

type ToolbarState = { from: number; to: number; top: number; left: number };

const ACTIONS: { id: RewriteAction | "cite"; label: string; kbd: string }[] = [
  { id: "tighten", label: "Tighten", kbd: "⌘1" },
  { id: "match_voice", label: "Match voice", kbd: "⌘2" },
  { id: "cite", label: "Cite", kbd: "⌘3" },
  { id: "expand", label: "Expand", kbd: "⌘4" },
];

export default function SelectionToolbar({
  editor,
  containerRef,
  keyRegistry,
  workspaceId,
  docId,
  docTitle,
  base,
}: {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
  keyRegistry: KeyHandlerRegistry;
  workspaceId: string;
  docId: string;
  docTitle: string;
  base: string;
}) {
  const [bar, setBar] = useState<ToolbarState | null>(null);
  const [busy, setBusy] = useState<RewriteAction | "cite" | null>(null);
  const [citeResults, setCiteResults] = useState<RelatedResult[] | null>(null);
  const barRef = useRef<ToolbarState | null>(null);
  const busyRef = useRef<typeof busy>(null);

  useEffect(() => {
    barRef.current = bar;
    busyRef.current = busy;
  }, [bar, busy]);

  const close = useCallback(() => {
    setBar(null);
    setCiteResults(null);
  }, []);

  useEffect(() => {
    const onSelection = () => {
      if (busyRef.current) return; // keep position stable while rewriting
      const { from, to, empty } = editor.state.selection;
      const container = containerRef.current;
      if (empty || !container || !editor.isEditable) {
        close();
        return;
      }
      const text = editor.state.doc.textBetween(from, to, "\n").trim();
      if (!text) {
        close();
        return;
      }
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const rect = container.getBoundingClientRect();
      setBar({
        from,
        to,
        top: start.top - rect.top + container.scrollTop - 10,
        left: Math.min(Math.max((start.left + end.left) / 2 - rect.left, 130), rect.width - 130),
      });
      setCiteResults(null);
    };
    editor.on("selectionUpdate", onSelection);
    return () => {
      editor.off("selectionUpdate", onSelection);
    };
  }, [editor, containerRef, close]);

  const runRewrite = useCallback(
    async (action: RewriteAction) => {
      const range = barRef.current;
      if (!range || busyRef.current) return;
      const text = editor.state.doc.textBetween(range.from, range.to, "\n");
      setBusy(action);
      try {
        const res = await fetch("/api/ai/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: workspaceId,
            action,
            text,
            doc_title: docTitle,
          }),
        });
        const data = await res.json();
        if (typeof data.text === "string" && data.text.trim()) {
          const nodes = markdownToTiptap(data.text).content ?? [];
          // A single paragraph replaces the selection inline; anything
          // larger (lists, multiple paragraphs) replaces it as blocks.
          const content =
            nodes.length === 1 && nodes[0].type === "paragraph"
              ? (nodes[0].content ?? [])
              : nodes;
          editor
            .chain()
            .focus()
            .insertContentAt({ from: range.from, to: range.to }, content)
            .run();
        }
      } catch {
        // Leave the passage untouched on failure.
      } finally {
        setBusy(null);
        close();
      }
    },
    [editor, workspaceId, docTitle, close],
  );

  const runCite = useCallback(async () => {
    const range = barRef.current;
    if (!range || busyRef.current) return;
    const text = editor.state.doc.textBetween(range.from, range.to, "\n");
    setBusy("cite");
    setCiteResults([]);
    try {
      const res = await fetch("/api/ai/related", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, doc_id: docId, text }),
      });
      const data = await res.json();
      setCiteResults(data.results ?? []);
    } catch {
      setCiteResults([]);
    } finally {
      setBusy(null);
    }
  }, [editor, workspaceId, docId]);

  const applyCite = useCallback(
    (r: RelatedResult) => {
      const range = barRef.current;
      if (!range) return;
      editor
        .chain()
        .focus()
        .setTextSelection({ from: range.from, to: range.to })
        .setLink({ href: `${base}/docs/${r.doc_id}` })
        .run();
      close();
    },
    [editor, base, close],
  );

  const runRewriteRef = useRef(runRewrite);
  const runCiteRef = useRef(runCite);

  useEffect(() => {
    runRewriteRef.current = runRewrite;
    runCiteRef.current = runCite;
  }, [runRewrite, runCite]);

  useEffect(() => {
    return keyRegistry.register((event) => {
      if (!barRef.current || !(event.metaKey || event.ctrlKey)) return false;
      switch (event.key) {
        case "1":
          runRewriteRef.current("tighten");
          return true;
        case "2":
          runRewriteRef.current("match_voice");
          return true;
        case "3":
          runCiteRef.current();
          return true;
        case "4":
          runRewriteRef.current("expand");
          return true;
        default:
          return false;
      }
    });
  }, [keyRegistry]);

  if (!bar) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: bar.top,
        left: bar.left,
        transform: "translate(-50%, -100%)",
        zIndex: 30,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: 4,
          background: "var(--text-primary)",
          borderRadius: 8,
          boxShadow: "0 12px 28px -8px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.10)",
          whiteSpace: "nowrap",
          position: "relative",
        }}
      >
        {busy ? (
          <span
            style={{
              padding: "2px 10px",
              fontSize: 11.5,
              fontWeight: 500,
              color: "rgba(255,255,255,0.86)",
            }}
          >
            {busy === "cite" ? "Finding approved docs…" : "Rewriting…"}
          </span>
        ) : (
          ACTIONS.map((a, i) => (
            <span key={a.id} style={{ display: "inline-flex", alignItems: "center" }}>
              {i > 0 && (
                <span
                  style={{
                    width: 1,
                    alignSelf: "stretch",
                    background: "rgba(255,255,255,0.10)",
                    margin: "0 1px",
                  }}
                />
              )}
              <button
                onClick={() => (a.id === "cite" ? runCite() : runRewrite(a.id))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 22,
                  padding: "0 8px",
                  borderRadius: 4,
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.86)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {a.label}
                <kbd
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "rgba(255,255,255,0.55)",
                    padding: "0 4px",
                    borderRadius: 3,
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  {a.kbd}
                </kbd>
              </button>
            </span>
          ))
        )}
        <span
          style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid var(--text-primary)",
          }}
        />
      </div>

      {citeResults !== null && !busy && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 320,
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            borderRadius: 10,
            boxShadow: "0 12px 32px -8px rgba(20,20,18,0.22)",
            padding: 6,
            zIndex: 31,
          }}
        >
          {citeResults.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 12.5, color: "var(--text-muted)" }}>
              No approved docs matched this passage.
            </div>
          ) : (
            citeResults.map((r) => (
              <div
                key={r.doc_id + (r.heading ?? "")}
                onClick={() => applyCite(r)}
                style={{
                  padding: "7px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-light)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                  {r.doc_title}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {r.space}
                  {r.heading ? ` · § ${r.heading}` : ""}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

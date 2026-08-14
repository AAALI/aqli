"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  IconCheckCircle,
  IconLink,
  IconPlus,
  IconQuote,
  IconSparkle,
  IconWarn,
} from "@/components/aqli/icons";
import { expectedSections, normalizeHeading } from "@/components/editor/templates";
import type { DocType } from "@/types/doc";
import type { RelatedResult } from "./types";

/**
 * The editor's right rail. Three blocks, each with a live job:
 *
 *   · On this doc — the real outline, with how far each section has got
 *   · Draw from   — approved passages that match what is being written
 *   · Consistency — a standing verdict, not a button you remember to press
 *
 * It previously shipped three inert boxes ("Add headings to build the
 * outline", "Nothing yet", "Consistency check … Run"), which is the thing this
 * redesign is undoing: a panel either has data or says something purposeful
 * about not having it.
 */
export default function EditorRail({
  editor,
  docTitle,
  docType,
  workspaceId,
  docId,
  base,
}: {
  editor: Editor;
  docTitle: string;
  docType: DocType;
  workspaceId: string;
  docId: string;
  base: string;
}) {
  const outline = useOutline(editor, docType);

  return (
    <aside
      className="doc-rail"
      style={{
        borderLeft: "1px solid var(--border)",
        background: "var(--bg-card)",
        overflowY: "auto",
      }}
    >
      <OutlineSection editor={editor} docTitle={docTitle} outline={outline} />
      <DrawFromSection
        editor={editor}
        workspaceId={workspaceId}
        docId={docId}
        base={base}
      />
      <ConsistencySection
        editor={editor}
        docTitle={docTitle}
        workspaceId={workspaceId}
        docId={docId}
        missing={outline.missing}
        onAdd={outline.addSection}
      />
    </aside>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return <div className="rail-label">{children}</div>;
}

// ── Outline ──────────────────────────────────────────────────────────

type OutlineItem = {
  level: number;
  text: string;
  pos: number;
  current: boolean;
  /** How far this section has got, 0–100. */
  pct: number;
};

/** Words of prose that read as a finished section. Above this, 100%. */
const SECTION_TARGET_WORDS = 60;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * The outline, plus the sections this doc type expects but does not have.
 *
 * Completion is measured from the prose between one heading and the next: an
 * empty section reads 0%, and it climbs to 100% at `SECTION_TARGET_WORDS`. It
 * is a progress hint, not a grade — what it is really for is making an
 * untouched section visible without having to scroll to it.
 */
function useOutline(editor: Editor, docType: DocType) {
  const [items, setItems] = useState<OutlineItem[]>([]);
  const expected = useMemo(() => expectedSections(docType), [docType]);

  useEffect(() => {
    const recompute = () => {
      const headings: { level: number; text: string; pos: number; end: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          headings.push({
            level: Number(node.attrs.level ?? 2),
            text: node.textContent || "Untitled section",
            pos,
            end: pos + node.nodeSize,
          });
        }
      });

      const docEnd = editor.state.doc.content.size;
      const cursor = editor.state.selection.from;
      let currentIdx = -1;
      headings.forEach((h, i) => {
        if (h.pos <= cursor) currentIdx = i;
      });

      setItems(
        headings.map((h, i) => {
          // Everything up to the next heading at the same level or higher —
          // a sub-heading's prose still counts toward its parent.
          const nextIdx = headings.findIndex(
            (other, j) => j > i && other.level <= h.level,
          );
          const sectionEnd = nextIdx === -1 ? docEnd : headings[nextIdx].pos;
          const words = countWords(
            editor.state.doc.textBetween(Math.min(h.end, sectionEnd), sectionEnd, " "),
          );
          return {
            level: h.level,
            text: h.text,
            pos: h.pos,
            current: i === currentIdx,
            pct: Math.min(100, Math.round((words / SECTION_TARGET_WORDS) * 100)),
          };
        }),
      );
    };

    recompute();
    editor.on("update", recompute);
    editor.on("selectionUpdate", recompute);
    return () => {
      editor.off("update", recompute);
      editor.off("selectionUpdate", recompute);
    };
  }, [editor]);

  const present = useMemo(
    () => new Set(items.map((i) => normalizeHeading(i.text))),
    [items],
  );
  const missing = useMemo(
    () => expected.filter((s) => !present.has(normalizeHeading(s.heading))),
    [expected, present],
  );

  /** Append an expected-but-absent section and put the caret in it. */
  const addSection = useCallback(
    (heading: string) => {
      editor
        .chain()
        .focus("end")
        .insertContentAt(editor.state.doc.content.size, [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: heading }] },
          { type: "paragraph" },
        ])
        .run();
    },
    [editor],
  );

  return { items, missing, addSection };
}

function OutlineSection({
  editor,
  docTitle,
  outline,
}: {
  editor: Editor;
  docTitle: string;
  outline: ReturnType<typeof useOutline>;
}) {
  const jump = useCallback(
    (pos: number) => {
      editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
    },
    [editor],
  );

  const { items, missing, addSection } = outline;
  const empty = items.length === 0 && missing.length === 0;

  return (
    <div className="rail-block">
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

        {empty ? (
          <div className="rail-empty" style={{ padding: "4px 8px" }}>
            This doc type has no set structure — the outline fills in as you add
            headings.
          </div>
        ) : (
          <>
            {items.map((o, i) => (
              <button
                type="button"
                key={`${o.pos}-${i}`}
                onClick={() => jump(o.pos)}
                className={`ol-item${o.current ? " cur" : ""}`}
                style={{ paddingLeft: 8 + (o.level - 1) * 10 }}
              >
                <span className="ol-text">{o.text}</span>
                <span className="ol-pct">{o.pct}%</span>
              </button>
            ))}

            {missing.map((s) => (
              <button
                type="button"
                key={`missing-${s.heading}`}
                onClick={() => addSection(s.heading)}
                className="ol-item missing"
                style={{ paddingLeft: 18, cursor: "pointer" }}
                title={`${s.hint} — click to add this section`}
              >
                <span className="ol-text">{s.heading}</span>
                <span className="ol-pct">· missing</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Draw from — approved passages matching the draft ─────────────────

function DrawFromSection({
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
  /** Null until the first query actually completes — "nothing matched" and
      "we have not looked yet" are different things to say. */
  const [searched, setSearched] = useState(false);
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
          setSearched(true);
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
    <div className="rail-block">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <RailLabel>Draw from</RailLabel>
        <span style={{ color: "var(--accent)", display: "flex" }}>
          <IconSparkle size={12} />
        </span>
      </div>

      {cards.length === 0 ? (
        <div className="rail-empty">
          {loading
            ? "Searching approved docs…"
            : searched
              ? "No approved doc covers this yet — you're writing the first word on it."
              : "Write a line or two and approved passages that overlap will appear here to quote or cite."}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {cards.map((r) => (
            <div key={r.doc_id + (r.heading ?? "")} className="draw-card">
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
              <p className="draw-excerpt">{r.excerpt}</p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                  marginTop: 2,
                }}
              >
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
      type="button"
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

// ── Consistency — a standing verdict, not a button ───────────────────

type Hint = { level: "ok" | "warn"; text: string };

function ConsistencySection({
  editor,
  docTitle,
  workspaceId,
  docId,
  missing,
  onAdd,
}: {
  editor: Editor;
  docTitle: string;
  workspaceId: string;
  docId: string;
  missing: { heading: string; hint: string }[];
  onAdd: (heading: string) => void;
}) {
  const [hints, setHints] = useState<Hint[]>([]);
  const [running, setRunning] = useState(false);
  const lastBody = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Runs continuously — there is no "Run" button any more. The check is
  // debounced well behind the 2s autosave so it never competes with typing.
  useEffect(() => {
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const { tiptapToMarkdown } = await import("@/lib/markdown/tiptap-to-md");
        const body = tiptapToMarkdown(editor.getJSON() as Record<string, unknown>);
        if (body.trim().length < 120 || body === lastBody.current) return;
        lastBody.current = body;
        setRunning(true);
        try {
          const res = await fetch("/api/ai/consistency", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspace_id: workspaceId,
              doc_id: docId,
              title: docTitle,
              body_md: body,
            }),
          });
          const data = await res.json();
          setHints(data.hints ?? []);
        } catch {
          // Keep the last verdict rather than flashing a false all-clear.
        } finally {
          setRunning(false);
        }
      }, 4000);
    };
    schedule();
    editor.on("update", schedule);
    return () => {
      editor.off("update", schedule);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [editor, workspaceId, docId, docTitle]);

  const ok = hints.find((h) => h.level === "ok") ?? null;
  // A missing section is the one warning we can actually offer a fix for, so
  // it outranks the model's prose hints. At most one warning either way.
  const gap = missing[0] ?? null;
  const warn = gap ? null : (hints.find((h) => h.level === "warn") ?? null);

  const nothingToSay = !ok && !gap && !warn;

  return (
    <div className="rail-block" style={{ paddingBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <RailLabel>Consistency</RailLabel>
        {running && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Checking…</span>
        )}
      </div>

      {nothingToSay ? (
        <div className="rail-empty">
          {running ? "Checking…" : "Nothing out of step with the approved corpus."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ok && <HintLine level="ok">{ok.text}</HintLine>}

          {gap && (
            <HintLine level="warn">
              No <strong style={{ fontWeight: 500 }}>{gap.heading}</strong> section
              yet.{" "}
              <button
                type="button"
                onClick={() => onAdd(gap.heading)}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  font: "inherit",
                  color: "var(--accent)",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <IconPlus size={10} />
                Add it
              </button>
            </HintLine>
          )}

          {warn && <HintLine level="warn">{warn.text}</HintLine>}
        </div>
      )}
    </div>
  );
}

function HintLine({
  level,
  children,
}: {
  level: "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div
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
          color: level === "ok" ? "var(--approved-text)" : "var(--review-text)",
          marginTop: 2,
        }}
      >
        {level === "ok" ? <IconCheckCircle size={14} sw={1.8} /> : <IconWarn size={14} />}
      </span>
      <span>{children}</span>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { Editor } from "@tiptap/react";
import { IconChat, IconLink, IconQuote, IconSparkle, IconTable } from "@/components/aqli/icons";
import type { KeyHandlerRegistry, RelatedResult } from "./types";

type Cmd = {
  id: string;
  icon: ReactNode;
  name: string;
  hint: string;
  keywords: string;
};

/**
 * Seven commands and one way to ask (v3 §4).
 *
 * The old menu had twelve, including Subheading, Image, Code block and
 * Diagram. Nothing was lost by trimming it — `###` still makes a subheading,
 * images still paste and drop, ``` still opens a code block and ```mermaid a
 * diagram. What went is the *list*, which is the point: a menu you scan is a
 * menu that interrupts.
 */
const CMDS: Cmd[] = [
  { id: "h2", icon: <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600 }}>H</span>, name: "Heading", hint: "Section title", keywords: "heading h2 section title" },
  { id: "bullet", icon: <span>•</span>, name: "Bulleted list", hint: "One point per line", keywords: "bullet list ul points" },
  { id: "ordered", icon: <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>1.</span>, name: "Numbered list", hint: "Steps, in order", keywords: "numbered ordered list ol steps" },
  { id: "table", icon: <IconTable size={14} />, name: "Table", hint: "Owners, dates, decisions", keywords: "table grid rows columns" },
  { id: "quote", icon: <IconQuote size={14} />, name: "Quote", hint: "Set a passage apart", keywords: "quote blockquote passage" },
  { id: "divider", icon: <span>—</span>, name: "Divider", hint: "Break the page", keywords: "divider rule hr break" },
  { id: "cite", icon: <IconChat size={14} />, name: "Cite a doc", hint: "Links both ways, automatically", keywords: "cite reference link doc backlink" },
  { id: "ask", icon: <IconSparkle size={14} />, name: "Ask Aqli to draft this", hint: "Uses what your team already wrote", keywords: "ask aqli ai draft write agent" },
];

type MenuState = {
  slashPos: number;
  query: string;
  top: number;
  left: number;
};

/** Matches `.slash` in globals.css. Used to clamp the popover to the column. */
const MENU_WIDTH = 322;

export default function SlashMenu({
  editor,
  containerRef,
  keyRegistry,
  workspaceId,
  docId,
  base,
  onAskAgent,
}: {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
  keyRegistry: KeyHandlerRegistry;
  workspaceId: string;
  docId: string;
  base: string;
  onAskAgent: () => void;
}) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [selected, setSelected] = useState(0);
  const [citeResults, setCiteResults] = useState<RelatedResult[] | null>(null);
  const [citeLoading, setCiteLoading] = useState(false);
  const menuRef = useRef<MenuState | null>(null);
  const selectedRef = useRef(0);
  const citeRef = useRef<RelatedResult[] | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current = menu;
    selectedRef.current = selected;
    citeRef.current = citeResults;
  }, [menu, selected, citeResults]);

  const close = useCallback(() => {
    setMenu(null);
    setSelected(0);
    setCiteResults(null);
    setCiteLoading(false);
  }, []);

  // Detect a trailing "/query" before the caret on every transaction.
  useEffect(() => {
    const onTransaction = () => {
      // While the cite picker is open the slash text is already deleted.
      if (citeRef.current !== null) return;
      const { selection } = editor.state;
      const { $from, empty } = selection;
      if (!empty || !$from.parent.isTextblock || $from.parent.type.name === "codeBlock") {
        if (menuRef.current) close();
        return;
      }
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
      const m = textBefore.match(/(?:^|\s)\/([\w ]{0,24})$/);
      if (!m) {
        if (menuRef.current) close();
        return;
      }
      const query = m[1];
      const slashPos = $from.pos - query.length - 1;
      const container = containerRef.current;
      if (!container) return;
      const coords = editor.view.coordsAtPos(slashPos);
      const rect = container.getBoundingClientRect();
      // 8px below the caret, flipped above when it would overflow the stage,
      // and clamped so the popover never hangs off the right edge (§4).
      const height = elRef.current?.offsetHeight ?? 300;
      const below = coords.bottom - rect.top + container.scrollTop + 8;
      const wouldOverflow = coords.bottom - rect.top + 8 + height > rect.height;
      const above = coords.top - rect.top + container.scrollTop - height - 8;
      setMenu({
        slashPos,
        query,
        top: wouldOverflow && above > 8 ? above : below,
        left: Math.min(coords.left - rect.left, rect.width - MENU_WIDTH - 18),
      });
      setSelected(0);
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor, containerRef, close]);

  const filtered = useMemo(
    () =>
      menu
        ? CMDS.filter((c) =>
            `${c.name} ${c.keywords}`.toLowerCase().includes(menu.query.toLowerCase().trim()),
          )
        : [],
    [menu],
  );
  const filteredRef = useRef(filtered);

  useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  const runCommand = useCallback(
    (cmd: Cmd) => {
      const m = menuRef.current;
      if (!m) return;
      const to = editor.state.selection.from;
      // The typed "/query" is deleted before anything is inserted, always.
      const chain = editor.chain().focus().deleteRange({ from: m.slashPos, to });
      switch (cmd.id) {
        case "h2":
          chain.setNode("heading", { level: 2 }).run();
          break;
        case "bullet":
          chain.toggleBulletList().run();
          break;
        case "ordered":
          chain.toggleOrderedList().run();
          break;
        case "quote":
          chain.toggleBlockquote().run();
          break;
        case "divider":
          chain.setHorizontalRule().run();
          break;
        case "table":
          // Header row on by default: GFM has no headerless table, so the
          // first row becomes one on save either way (see `table` in
          // lib/markdown/serializer.ts). Starting with it visible means the
          // editor shows what the markdown will say.
          chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
          break;
        case "ask":
          chain.run();
          onAskAgent();
          break;
        case "cite": {
          chain.run();
          // Switch the popover into cite-picker mode, searching with the
          // text of the block the user is writing in.
          setCiteLoading(true);
          setCiteResults([]);
          setSelected(0);
          const { $from } = editor.state.selection;
          const blockText = $from.parent.textContent.trim();
          fetch("/api/ai/related", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspace_id: workspaceId,
              doc_id: docId,
              text: blockText || "overview",
            }),
          })
            .then((r) => r.json())
            .then((data) => setCiteResults(data.results ?? []))
            .catch(() => setCiteResults([]))
            .finally(() => setCiteLoading(false));
          return; // keep the menu open in cite mode
        }
      }
      if (cmd.id !== "cite") close();
    },
    [editor, workspaceId, docId, onAskAgent, close],
  );

  const insertCitation = useCallback(
    (r: RelatedResult) => {
      editor
        .chain()
        .focus()
        .insertContent([
          {
            type: "text",
            text: r.doc_title,
            marks: [{ type: "link", attrs: { href: `${base}/docs/${r.doc_id}` } }],
          },
          { type: "text", text: " " },
        ])
        .run();
      close();
    },
    [editor, base, close],
  );

  const runCommandRef = useRef(runCommand);
  const insertCitationRef = useRef(insertCitation);

  useEffect(() => {
    runCommandRef.current = runCommand;
    insertCitationRef.current = insertCitation;
  }, [runCommand, insertCitation]);

  // Keyboard navigation, consumed before ProseMirror sees the keys.
  useEffect(() => {
    return keyRegistry.register((event) => {
      if (!menuRef.current) return false;
      const inCite = citeRef.current !== null;
      const count = inCite ? (citeRef.current?.length ?? 0) : filteredRef.current.length;
      switch (event.key) {
        case "ArrowDown":
          setSelected((s) => (count ? (s + 1) % count : 0));
          return true;
        case "ArrowUp":
          setSelected((s) => (count ? (s - 1 + count) % count : 0));
          return true;
        case "Enter": {
          if (inCite) {
            const r = citeRef.current?.[selectedRef.current];
            if (r) insertCitationRef.current(r);
            else close();
          } else {
            const cmd = filteredRef.current[selectedRef.current];
            if (cmd) runCommandRef.current(cmd);
            else close();
          }
          return true;
        }
        case "Escape":
          close();
          return true;
        default:
          return false;
      }
    });
  }, [keyRegistry, close]);

  if (!menu) return null;
  if (citeResults === null && filtered.length === 0) return null;

  return (
    <div
      ref={elRef}
      className="slash"
      role="listbox"
      aria-label={citeResults !== null ? "Cite a doc" : "Insert"}
      style={{ top: menu.top, left: Math.max(menu.left, 16) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {citeResults !== null ? (
        citeLoading ? (
          <p className="si-empty">Searching…</p>
        ) : citeResults.length === 0 ? (
          <p className="si-empty">Nobody has written this down.</p>
        ) : (
          citeResults.map((r, i) => (
            <button
              type="button"
              key={r.doc_id + (r.heading ?? "")}
              role="option"
              aria-selected={i === selected}
              className={`si${i === selected ? " is-on" : ""}`}
              onClick={() => insertCitation(r)}
              onMouseEnter={() => setSelected(i)}
            >
              <span className="sic"><IconLink size={13} /></span>
              <span style={{ minWidth: 0 }}>
                <b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.doc_title}
                </b>
                <em>
                  {r.space}
                  {r.heading ? ` · § ${r.heading}` : ""}
                </em>
              </span>
              <span className="kbd">↵</span>
            </button>
          ))
        )
      ) : (
        filtered.map((c, i) => (
          <button
            type="button"
            key={c.id}
            role="option"
            aria-selected={i === selected}
            className={`si${i === selected ? " is-on" : ""}`}
            onClick={() => runCommand(c)}
            onMouseEnter={() => setSelected(i)}
          >
            <span className="sic">{c.icon}</span>
            <span>
              <b>{c.name}</b>
              <em>{c.hint}</em>
            </span>
            <span className="kbd">↵</span>
          </button>
        ))
      )}
    </div>
  );
}

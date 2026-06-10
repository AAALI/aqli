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
import { IconLink, IconQuote, IconRobot } from "@/components/aqli/icons";
import type { KeyHandlerRegistry, RelatedResult } from "./types";

type Cmd = {
  id: string;
  icon: ReactNode;
  name: string;
  hint: string;
  keywords: string;
};

const CMDS: Cmd[] = [
  { id: "cite", icon: <IconQuote size={13} />, name: "Cite an approved doc", hint: "Inline reference, with backlink", keywords: "cite reference link doc" },
  { id: "agent", icon: <IconRobot size={13} />, name: "Ask agent to draft this section", hint: "Drafts in Co-write — you approve", keywords: "agent draft ai cowrite write" },
  { id: "h2", icon: <span style={{ fontFamily: "var(--font-serif)", fontSize: 14 }}>H</span>, name: "Heading", hint: "Section heading (H2)", keywords: "heading h2 section title" },
  { id: "h3", icon: <span style={{ fontFamily: "var(--font-serif)", fontSize: 12 }}>H</span>, name: "Subheading", hint: "Subsection heading (H3)", keywords: "heading h3 subsection" },
  { id: "bullet", icon: <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>•</span>, name: "Bulleted list", hint: "Plain list", keywords: "bullet list ul" },
  { id: "ordered", icon: <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>1.</span>, name: "Numbered list", hint: "Ordered list", keywords: "numbered ordered list ol" },
  { id: "quote", icon: <span style={{ fontFamily: "var(--font-serif)", fontSize: 15 }}>&ldquo;</span>, name: "Quote", hint: "Block quote", keywords: "quote blockquote" },
  { id: "code", icon: <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{"{}"}</span>, name: "Code block", hint: "Fenced code", keywords: "code fence pre" },
  { id: "divider", icon: <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>—</span>, name: "Divider", hint: "Horizontal rule", keywords: "divider rule hr" },
];

type MenuState = {
  slashPos: number;
  query: string;
  top: number;
  left: number;
};

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
      setMenu({
        slashPos,
        query,
        top: coords.bottom - rect.top + container.scrollTop + 6,
        left: Math.min(coords.left - rect.left, rect.width - 380),
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
      const chain = editor.chain().focus().deleteRange({ from: m.slashPos, to });
      switch (cmd.id) {
        case "h2":
          chain.setNode("heading", { level: 2 }).run();
          break;
        case "h3":
          chain.setNode("heading", { level: 3 }).run();
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
        case "code":
          chain.toggleCodeBlock().run();
          break;
        case "divider":
          chain.setHorizontalRule().run();
          break;
        case "agent":
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
      style={{
        position: "absolute",
        top: menu.top,
        left: Math.max(menu.left, 16),
        width: 360,
        background: "var(--bg-card)",
        border: "1px solid var(--border-strong)",
        borderRadius: 10,
        boxShadow: "0 12px 32px -8px rgba(20,20,18,0.22), 0 2px 6px rgba(20,20,18,0.06)",
        padding: 6,
        zIndex: 30,
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        style={{
          padding: "6px 10px 8px",
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{citeResults !== null ? "Cite an approved doc" : "Insert"}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 0 }}>
          {citeResults !== null ? "↵ to insert" : "/ to filter"}
        </span>
      </div>

      {citeResults !== null ? (
        citeLoading ? (
          <div style={{ padding: "10px 10px 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
            Searching approved docs…
          </div>
        ) : citeResults.length === 0 ? (
          <div style={{ padding: "10px 10px 12px", fontSize: 12.5, color: "var(--text-muted)" }}>
            No approved docs matched this passage.
          </div>
        ) : (
          citeResults.map((r, i) => (
            <div
              key={r.doc_id + (r.heading ?? "")}
              onClick={() => insertCitation(r)}
              onMouseEnter={() => setSelected(i)}
              style={{
                display: "grid",
                gridTemplateColumns: "22px 1fr",
                gap: 10,
                padding: "8px 10px",
                background: i === selected ? "var(--accent-light)" : "transparent",
                border: `1px solid ${i === selected ? "rgba(15,110,86,0.18)" : "transparent"}`,
                borderRadius: 6,
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: i === selected ? "rgba(15,110,86,0.14)" : "var(--bg-sidebar)",
                  color: i === selected ? "var(--accent)" : "var(--text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconLink size={12} />
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: i === selected ? "var(--accent)" : "var(--text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.doc_title}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {r.space}
                  {r.heading ? ` · § ${r.heading}` : ""}
                </span>
              </div>
            </div>
          ))
        )
      ) : (
        filtered.map((c, i) => (
          <div
            key={c.id}
            onClick={() => runCommand(c)}
            onMouseEnter={() => setSelected(i)}
            style={{
              display: "grid",
              gridTemplateColumns: "22px 1fr",
              gap: 10,
              padding: "8px 10px",
              background: i === selected ? "var(--accent-light)" : "transparent",
              border: `1px solid ${i === selected ? "rgba(15,110,86,0.18)" : "transparent"}`,
              borderRadius: 6,
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: i === selected ? "rgba(15,110,86,0.14)" : "var(--bg-sidebar)",
                color: i === selected ? "var(--accent)" : "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {c.icon}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: i === selected ? "var(--accent)" : "var(--text-primary)",
                }}
              >
                {c.name}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{c.hint}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

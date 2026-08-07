"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";

/**
 * Row and column controls, shown while the caret is inside a table.
 *
 * Tables are the one allowlisted node with no keyboard spelling — you can type
 * a list or a heading with markdown shortcuts, but there is no way to add a
 * column by typing. Without this the `/table` command produces a 3×3 grid that
 * can never be anything else.
 *
 * Deliberately not a hover UI: it follows the caret, so it works the same on a
 * touch screen, where there is no hover.
 */

type BarState = { top: number; left: number };

export default function TableControls({
  editor,
  containerRef,
}: {
  editor: Editor;
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const [bar, setBar] = useState<BarState | null>(null);

  const reposition = useCallback(() => {
    const container = containerRef.current;
    if (!container || !editor.isEditable || !editor.isActive("table")) {
      setBar(null);
      return;
    }

    // Anchor to the table element itself rather than the caret, so the bar
    // does not jump between cells as the user tabs across a row.
    const dom = editor.view.domAtPos(editor.state.selection.from).node;
    const element = dom instanceof HTMLElement ? dom : dom.parentElement;
    const table = element?.closest("table");
    if (!table) {
      setBar(null);
      return;
    }

    const tableRect = table.getBoundingClientRect();
    const rect = container.getBoundingClientRect();
    setBar({
      top: tableRect.top - rect.top + container.scrollTop - 40,
      left: tableRect.left - rect.left,
    });
  }, [editor, containerRef]);

  useEffect(() => {
    editor.on("selectionUpdate", reposition);
    editor.on("transaction", reposition);
    return () => {
      editor.off("selectionUpdate", reposition);
      editor.off("transaction", reposition);
    };
  }, [editor, reposition]);

  if (!bar) return null;

  const actions: { label: string; title: string; run: () => void }[] = [
    {
      label: "+ Row",
      title: "Add a row below",
      run: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      label: "+ Col",
      title: "Add a column to the right",
      run: () => editor.chain().focus().addColumnAfter().run(),
    },
    {
      label: "− Row",
      title: "Delete this row",
      run: () => editor.chain().focus().deleteRow().run(),
    },
    {
      label: "− Col",
      title: "Delete this column",
      run: () => editor.chain().focus().deleteColumn().run(),
    },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: bar.top,
        left: bar.left,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        background: "var(--bg-card)",
        border: "1px solid var(--border-strong)",
        borderRadius: 8,
        boxShadow: "0 8px 24px -8px rgba(20,20,18,0.20), 0 1px 3px rgba(20,20,18,0.06)",
        zIndex: 25,
      }}
      // Keep the caret in the cell the action applies to.
      onMouseDown={(e) => e.preventDefault()}
    >
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          title={a.title}
          onClick={a.run}
          style={buttonStyle}
        >
          {a.label}
        </button>
      ))}
      <span style={{ width: 1, height: 18, background: "var(--border)", margin: "0 3px" }} />
      <button
        type="button"
        title="Delete this table"
        onClick={() => editor.chain().focus().deleteTable().run()}
        style={{ ...buttonStyle, color: "#993C1D" }}
      >
        Delete table
      </button>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "4px 8px",
  fontFamily: "var(--font-sans)",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.4,
  color: "var(--text-secondary)",
  background: "transparent",
  border: 0,
  borderRadius: 5,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

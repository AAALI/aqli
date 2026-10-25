"use client";

import type { Editor } from "@tiptap/react";
import { IconSparkle } from "@/components/aqli/icons";
import { useKeyboardInset } from "./useKeyboardInset";

/**
 * Writing on a phone (frame 14): no slash menu to reach for, so the few
 * structures that matter sit on the keyboard — heading, bold, italic, list —
 * and the AI dot moves here, right-aligned. Hidden by CSS above 767px.
 * `onMouseDown` + preventDefault keeps the editor's focus (and the keyboard)
 * where it is when a button is tapped.
 *
 * "Sits on the keyboard" has to be done by hand on iOS: Safari overlays the
 * keyboard without resizing the page, so a `bottom: 0` bar ends up behind it.
 * The bar watches the visual viewport and lifts itself by the difference.
 */
export default function PhoneFormatBar({ editor, onAsk }: { editor: Editor; onAsk: () => void }) {
  const tap = (run: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    run();
  };
  const inset = useKeyboardInset();
  return (
    <div
      className={`pformat${inset ? " on-keyboard" : ""}`}
      role="toolbar"
      aria-label="Formatting"
      style={inset ? { bottom: inset } : undefined}
    >
      <button type="button" className="iconbtn" aria-label="Heading" onMouseDown={tap(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 600 }}>
        H
      </button>
      <button type="button" className="iconbtn" aria-label="Bold" onMouseDown={tap(() => editor.chain().focus().toggleBold().run())} style={{ fontWeight: 700 }}>
        B
      </button>
      <button type="button" className="iconbtn" aria-label="Italic" onMouseDown={tap(() => editor.chain().focus().toggleItalic().run())} style={{ fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
        I
      </button>
      <button type="button" className="iconbtn" aria-label="Bulleted list" onMouseDown={tap(() => editor.chain().focus().toggleBulletList().run())}>
        •
      </button>
      <button type="button" className="iconbtn" aria-label="Numbered list" onMouseDown={tap(() => editor.chain().focus().toggleOrderedList().run())} style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
        1.
      </button>
      <span style={{ flex: 1 }} />
      <button type="button" className="iconbtn" aria-label="Ask Aqli" onMouseDown={tap(onAsk)} style={{ color: "var(--accent)" }}>
        <IconSparkle size={16} />
      </button>
    </div>
  );
}

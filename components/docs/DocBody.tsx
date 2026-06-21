"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * Pull the plain text out of a Tiptap node (its `text` leaves, concatenated).
 */
function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text" && typeof n.text === "string") return n.text;
  if (Array.isArray(n.content)) return n.content.map(nodeText).join("");
  return "";
}

/**
 * Docs published from a merged PR (and some imports) carry the title as the
 * first `# Heading` in the body, which then renders twice — once as the page's
 * own `<h1>` and once at the top of the body. Drop that leading level-1 heading
 * when its text matches the title we already show above the body.
 */
function stripDuplicateTitle(
  content: Record<string, unknown> | null,
  title?: string,
): Record<string, unknown> | null {
  if (!content || !title) return content;
  const nodes = content.content;
  if (!Array.isArray(nodes) || nodes.length === 0) return content;
  const first = nodes[0] as { type?: string; attrs?: { level?: number } };
  const isTitleHeading =
    first?.type === "heading" &&
    (first.attrs?.level ?? 1) === 1 &&
    nodeText(first).trim().toLowerCase() === title.trim().toLowerCase();
  if (!isTitleHeading) return content;
  return { ...content, content: nodes.slice(1) };
}

/**
 * Read-only renderer for a doc's Tiptap JSON. Deliberately plain — no
 * full-height / overflow wrappers (unlike the editor's `AqliEditor`), so the
 * body flows naturally inside the viewer's own scroll column and headings get
 * correct offsets for the outline to jump to.
 */
export default function DocBody({
  content,
  title,
}: {
  content: Record<string, unknown> | null;
  /** The doc title shown above the body; used to drop a duplicate leading H1. */
  title?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
      }),
    ],
    content:
      stripDuplicateTitle(content, title) ?? {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  return <EditorContent editor={editor} className="prose prose-neutral max-w-none" />;
}

"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { CodeBlockWithMermaid } from "@/components/editor/MermaidCodeBlock";
import { hasTitleHeading, stripTitleHeading } from "@/lib/markdown/title-heading";

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
        codeBlock: false,
      }),
      CodeBlockWithMermaid,
    ],
    content:
      (content && hasTitleHeading(content, title) ? stripTitleHeading(content) : content) ?? {
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

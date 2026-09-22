"use client";

import { useEffect, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { CodeBlockWithMermaid } from "@/components/editor/MermaidCodeBlock";
import { aqliExtensions } from "@/lib/markdown/schema";
import { markdownToTiptap } from "@/lib/markdown/md-to-tiptap";
import { hasTitleHeading, stripTitleHeading } from "@/lib/markdown/title-heading";

/**
 * Read-only renderer for a doc. Deliberately plain — no full-height / overflow
 * wrappers, so the body flows naturally inside the paper column and headings
 * get correct offsets for the outline to jump to.
 *
 * **Reached only through `DocBodyClient`**, which loads it with `ssr: false`.
 * Import it directly from a page and Tiptap plus the whole markdown schema go
 * back into the Cloudflare worker — see that file for the measurement.
 *
 * It takes markdown rather than Tiptap JSON, and parses here, for the same
 * reason: `markdownToTiptap` imports `aqliSchema`, so doing the conversion on
 * the server would keep the schema in the worker even with the editor out of
 * it. Markdown is canonical anyway (step 6), so this parses what is stored.
 */
export default function DocBody({
  bodyMd,
  title,
}: {
  bodyMd: string | null;
  /** The doc title shown above the body; used to drop a duplicate leading H1. */
  title?: string;
}) {
  const content = useMemo(
    () => (bodyMd ? (markdownToTiptap(bodyMd) as unknown as Record<string, unknown>) : null),
    [bodyMd],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    // Same allowlist the editor mounts. A reader that cannot represent a node
    // the writer can produce shows the doc with content silently missing.
    extensions: aqliExtensions(CodeBlockWithMermaid),
    content:
      (content && hasTitleHeading(content, title) ? stripTitleHeading(content) : content) ?? {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
  }, [content]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // The same class the writing surface mounts. One implementation of the
  // paper column, so read and write cannot drift apart (v3 §2).
  return <EditorContent editor={editor} className="dbody" />;
}

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { useEffect } from "react";
import EditorToolbar from "./EditorToolbar";
import { tiptapToMarkdown } from "@/lib/markdown/tiptap-to-md";

type Props = {
  initialContent?: Record<string, unknown> | null;
  onChange?: (json: Record<string, unknown>, markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
};

export default function AqliEditor({
  initialContent,
  onChange,
  placeholder = "Start writing…",
  editable = true,
}: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content:
      initialContent ?? { type: "doc", content: [{ type: "paragraph" }] },
    editable,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as Record<string, unknown>;
      onChange?.(json, tiptapToMarkdown(json));
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral max-w-none px-8 py-6 focus:outline-none min-h-full",
      },
    },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  return (
    <div className="flex h-full flex-col">
      {editable && <EditorToolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}

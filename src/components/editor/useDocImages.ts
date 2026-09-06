"use client";

import { useCallback, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import { docImageRejection, isDocImageMime } from "@/lib/doc-images";

/**
 * Pasting, dropping and picking images in the editor (roadmap Phase 2 §1).
 *
 * Uploads are deliberately *not* represented in the document while they are in
 * flight. The obvious design — drop a placeholder node and swap it for the real
 * image — cannot work here: the schema is an allowlist derived from what
 * markdown can express (`lib/markdown/schema.ts`), so a placeholder node would
 * have to be added to the allowlist, and then an autosave landing mid-upload
 * would write it into canonical `body_md`. A counter and a status line cost the
 * user one line of feedback and cannot corrupt a document.
 */

function imageFilesFrom(
  transfer: DataTransfer | null | undefined,
): File[] {
  if (!transfer) return [];
  const fromFiles = Array.from(transfer.files ?? []);
  if (fromFiles.length > 0) return fromFiles.filter((f) => isDocImageMime(f.type));

  // Screenshot pastes arrive as items rather than files in some browsers.
  return Array.from(transfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((f): f is File => f !== null && isDocImageMime(f.type));
}

export type DocImages = {
  /** How many uploads are in flight. */
  uploading: number;
  error: string | null;
  dismissError: () => void;
  /** Open a file picker and insert at the caret. */
  pickAndInsert: () => void;
  handlePaste: (view: EditorView, event: ClipboardEvent) => boolean;
  handleDrop: (
    view: EditorView,
    event: DragEvent,
    slice: unknown,
    moved: boolean,
  ) => boolean;
  /**
   * Hand over the editor once `useEditor` has returned it.
   *
   * The hook has to run *before* `useEditor` — its handlers go into
   * `editorProps`, which is read at creation — so it cannot take the editor as
   * an argument. The handlers only fire on user interaction, long after this
   * has been called.
   */
  attach: (editor: Editor | null) => void;
};

export function useDocImages({
  workspaceId,
  docId,
}: {
  workspaceId: string;
  docId: string;
}): DocImages {
  const editorRef = useRef<Editor | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const attach = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);

  const insert = useCallback(
    async (files: File[], pos: number | null) => {
      for (const file of files) {
        const rejection = docImageRejection(file);
        if (rejection) {
          setError(rejection);
          continue;
        }

        setUploading((n) => n + 1);
        try {
          const body = new FormData();
          body.append("file", file);
          body.append("workspace_id", workspaceId);
          body.append("doc_id", docId);

          const res = await fetch("/api/uploads/image", { method: "POST", body });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Upload failed");

          const current = editorRef.current;
          if (!current) return;

          const content = {
            type: "image",
            attrs: { src: data.url, alt: data.alt ?? null },
          };
          const chain = current.chain().focus();
          if (pos === null) {
            chain.insertContent(content);
          } else {
            // The document can move while the upload is in flight, so the
            // recorded position may no longer exist. Clamping puts the image at
            // the end rather than throwing; typing through an upload is the
            // only way to notice, and it beats losing the paste.
            chain.insertContentAt(
              Math.min(pos, current.state.doc.content.size),
              content,
            );
          }
          chain.run();
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [workspaceId, docId],
  );

  const handlePaste = useCallback(
    (view: EditorView, event: ClipboardEvent) => {
      const files = imageFilesFrom(event.clipboardData);
      if (files.length === 0) return false;
      // Let a copied *document* paste normally; only take over for real files.
      event.preventDefault();
      void insert(files, view.state.selection.from);
      return true;
    },
    [insert],
  );

  const handleDrop = useCallback(
    (view: EditorView, event: DragEvent, _slice: unknown, moved: boolean) => {
      // `moved` is content being dragged within the document — not an upload.
      if (moved) return false;
      const files = imageFilesFrom(event.dataTransfer);
      if (files.length === 0) return false;
      event.preventDefault();
      const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
      void insert(files, at?.pos ?? view.state.selection.from);
      return true;
    },
    [insert],
  );

  const pickAndInsert = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/gif,image/webp";
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      if (files.length > 0) void insert(files, null);
    };
    input.click();
  }, [insert]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    uploading,
    error,
    dismissError,
    pickAndInsert,
    handlePaste,
    handleDrop,
    attach,
  };
}

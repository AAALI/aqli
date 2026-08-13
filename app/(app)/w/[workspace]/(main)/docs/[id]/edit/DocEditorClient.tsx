"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { CodeBlockWithMermaid } from "@/components/editor/MermaidCodeBlock";
import Link from "next/link";
import AppTopBar from "@/components/layout/AppTopBar";
import DocMetaRow from "@/components/docs/DocMetaRow";
import SlashMenu from "@/components/editor/v2/SlashMenu";
import SelectionToolbar from "@/components/editor/v2/SelectionToolbar";
import EditorRail from "@/components/editor/v2/EditorRail";
import FloatingAssistant from "@/components/ai/FloatingAssistant";
import ProcessStrip from "@/components/editor/v2/ProcessStrip";
import { IconEye } from "@/components/aqli/icons";
import type { KeyHandlerRegistry } from "@/components/editor/v2/types";
import { useDocImages } from "@/components/editor/useDocImages";
import TableControls from "@/components/editor/v2/TableControls";
import { aqliExtensions } from "@/lib/markdown/schema";
import { tiptapToMarkdown } from "@/lib/markdown/tiptap-to-md";
import { markdownToTiptap } from "@/lib/markdown/md-to-tiptap";
import {
  hasTitleHeading,
  prependTitleHeading,
  stripTitleHeading,
} from "@/lib/markdown/title-heading";
import { formatRelative } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

/**
 * A title is one line. The field is a textarea so long titles wrap on screen,
 * which also means a paste or a drop can carry newlines into it.
 */
function singleLine(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/g, " ");
}

export default function DocEditorClient({
  doc,
  workspaceSlug,
  version,
  ownerName,
  reviewers,
}: {
  doc: DocWithSpace;
  workspaceSlug: string;
  version: number;
  ownerName: string | null;
  /** Who a review request would reach — shown in the process strip. */
  reviewers: string[];
}) {
  const base = `/w/${workspaceSlug}`;
  const [title, setTitle] = useState(doc.title);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // A save into a `review_all` space becomes a proposal instead of an edit.
  // The document on screen is unchanged, so the status line must not say
  // "Saved" (spec §3.1).
  const [queuedForReview, setQueuedForReview] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Unsent (or failed) field updates, merged across edits. Cleared only after
  // the PUT that carried them succeeds, so the unload warning and the
  // unmount/next-edit retry stay armed on failure.
  const pendingUpdates = useRef<Record<string, unknown> | null>(null);
  const saveInFlight = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // The viewer hides a leading `# Title` that repeats the doc's own title, so
  // the editor hides it too — otherwise opening a PR-imported doc shows the
  // title twice. It is still part of the document: `bodyWithTitle` puts it back
  // on every save, which is also what keeps it in step when the title changes.
  const initialBody = useMemo(
    () =>
      doc.body_md
        ? (markdownToTiptap(doc.body_md) as unknown as Record<string, unknown>)
        : null,
    [doc.body_md],
  );
  const carriesTitleHeading = useMemo(
    () => hasTitleHeading(initialBody, doc.title),
    [initialBody, doc.title],
  );
  // `onUpdate` is registered once, so both the flag and the heading text have
  // to come from refs rather than the values that callback would close over.
  const carriesTitleRef = useRef(carriesTitleHeading);
  const titleValue = useRef(doc.title);
  // The last title handed to the save queue. Distinct from `doc.title`, which
  // never changes for the life of the component.
  const persistedTitle = useRef(doc.title);
  useEffect(() => {
    carriesTitleRef.current = carriesTitleHeading;
  }, [carriesTitleHeading]);
  const bodyWithTitle = useCallback(
    (json: Record<string, unknown>): Record<string, unknown> =>
      carriesTitleRef.current
        ? prependTitleHeading(json, titleValue.current)
        : json,
    [],
  );

  // Keep the title box exactly as tall as its content. Runs on mount too, so a
  // long title arrives already unwrapped rather than one line high.
  //
  // How many lines the title wraps to depends on the width as much as the text,
  // and the width moves without the text changing — a window resize, a rotation,
  // the reading rail dropping out at its breakpoint. Only width is acted on:
  // reacting to the height we just set would feed the observer its own output.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    fit();
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? lastWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      fit();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [title]);

  // Children (slash menu, selection toolbar) register key handlers that run
  // before ProseMirror's own keymap.
  const keyHandlersRef = useRef<Set<(event: KeyboardEvent) => boolean>>(new Set());
  const keyRegistry = useMemo<KeyHandlerRegistry>(
    () => ({
      register(handler) {
        keyHandlersRef.current.add(handler);
        return () => keyHandlersRef.current.delete(handler);
      },
    }),
    [],
  );

  const persistOnce = useCallback(
    async (updates: Record<string, unknown>): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch(`/api/docs/${doc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        // 202: accepted as a proposal, not applied. The write is safely
        // recorded, so this counts as sent — but it is not "saved".
        setQueuedForReview(res.status === 202);
        setLastSaved(new Date());
        setSaveError(false);
        return true;
      } catch (err) {
        // Expired session, RLS denial, offline — the next edit retries, but
        // the label must not claim "Saved" in the meantime.
        console.error("Autosave failed:", err);
        setSaveError(true);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [doc.id],
  );

  // Single-flight save pump: one PUT at a time, always carrying the latest
  // merged snapshot, so an older request can never land after a newer one.
  // On failure the snapshot is restored (newer edits win field-by-field) for
  // the unmount flush / unload warning / next-edit retry.
  const pumpSaves = useCallback(async () => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    try {
      while (pendingUpdates.current) {
        const updates = pendingUpdates.current;
        pendingUpdates.current = null;
        const ok = await persistOnce(updates);
        if (!ok) {
          pendingUpdates.current = { ...updates, ...(pendingUpdates.current ?? {}) };
          break;
        }
      }
    } finally {
      saveInFlight.current = false;
    }
  }, [persistOnce]);

  // Merge field updates into the pending snapshot; sending happens via the
  // pump (immediately, or debounced by the caller's timer).
  const queueUpdates = useCallback((updates: Record<string, unknown>) => {
    pendingUpdates.current = { ...(pendingUpdates.current ?? {}), ...updates };
  }, []);

  // Declared before `useEditor` because its handlers go into `editorProps`,
  // which is read when the editor is created.
  const images = useDocImages({ workspaceId: doc.workspace_id, docId: doc.id });

  const editor = useEditor({
    immediatelyRender: false,
    // The allowlist in lib/markdown/schema.ts, not a hand-rolled StarterKit
    // list. Those two had drifted: this editor mounted no table, image or task
    // list, so a document containing any of them failed to load at all
    // ("Unknown node type: tableHeader") and — with body_md canonical — a save
    // wrote back markdown with the missing content deleted.
    extensions: [
      ...aqliExtensions(CodeBlockWithMermaid),
      Placeholder.configure({
        placeholder: "Start writing — type / for commands…",
      }),
    ],
    // Markdown is canonical since step 6, so the editor opens what the
    // document actually is rather than a cached tree that may lag it — an
    // agent's merge writes body_md and body_json together, but a rollback or a
    // hand-edit only touches the markdown.
    content: initialBody
      ? carriesTitleHeading
        ? stripTitleHeading(initialBody)
        : initialBody
      : { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => {
      const json = bodyWithTitle(editor.getJSON() as Record<string, unknown>);
      // Queue immediately (arms the unload warning during the debounce
      // window); the timer only decides when the pump sends it.
      // body_json rides along as the editor's cache. body_md is the save.
      queueUpdates({ body_json: json, body_md: tiptapToMarkdown(json) });
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void pumpSaves(), 2000); // 2s debounce
    },
    editorProps: {
      attributes: { class: "ed2-prose" },
      handleKeyDown: (_view, event) => {
        for (const handler of keyHandlersRef.current) {
          if (handler(event)) return true;
        }
        return false;
      },
      handlePaste: images.handlePaste,
      handleDrop: images.handleDrop,
    },
  });

  useEffect(() => {
    images.attach(editor);
  }, [images, editor]);

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // Client-side navigation unmounts mid-debounce: send the pending edits
  // immediately instead of dropping the last ≤2s of typing. (The fetch
  // outlives the component on soft navigations.)
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void pumpSaves();
    };
  }, [pumpSaves]);

  // Hard unloads (tab close, refresh) can't be flushed reliably — warn while
  // edits are unsent or a save is still in flight.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (pendingUpdates.current || saveInFlight.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // ⌘J toggles the Co-write chat from anywhere on the screen.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setChatOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const saveTitle = useCallback(
    (raw: string) => {
      const newTitle = singleLine(raw).trim() || "Untitled";
      titleValue.current = newTitle;
      // Against the last value sent, not the prop: `doc` is the server's
      // snapshot from page load, so renaming A -> B -> A would match it and
      // skip the PUT, leaving the document stored as B.
      if (newTitle === persistedTitle.current) return;
      persistedTitle.current = newTitle;
      // Through the same queue so a title PUT can't race a body PUT.
      queueUpdates({ title: newTitle });
      // A body that carries the title as its first heading has to be rewritten
      // too, or the markdown keeps asserting the old name.
      if (carriesTitleRef.current && editor) {
        const json = bodyWithTitle(editor.getJSON() as Record<string, unknown>);
        queueUpdates({ body_json: json, body_md: tiptapToMarkdown(json) });
      }
      void pumpSaves();
    },
    [queueUpdates, pumpSaves, editor, bodyWithTitle],
  );

  const askAgent = useCallback(() => {
    let section: string | null = null;
    if (editor) {
      const cursor = editor.state.selection.from;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading" && pos <= cursor) {
          section = node.textContent || null;
        }
      });
    }
    setChatPrefill(
      section
        ? `Draft the "${section}" section based on the rest of this doc.`
        : "Draft this section based on the rest of this doc.",
    );
    setChatOpen(true);
  }, [editor]);

  const savedLabel = images.uploading > 0
    ? `Uploading ${images.uploading === 1 ? "image" : `${images.uploading} images`}…`
    : saving
    ? "Saving…"
    : saveError
      ? "Couldn't save — retrying on next edit"
      : queuedForReview
        ? "Sent for review — this space approves every change"
        : lastSaved
          ? `Saved ${formatRelative(lastSaved)}`
          : `Saved ${formatRelative(doc.updated_at)}`;

  const spaceCrumb = doc.space
    ? { label: doc.space.name, href: `${base}/s/${doc.space.slug}` }
    : { label: "Home", href: base };

  return (
    <>
      <AppTopBar
        base={base}
        crumbs={[spaceCrumb, { label: title || "Untitled" }]}
        saved={savedLabel}
        share
        actions={
          <Link
            href={`${base}/docs/${doc.id}`}
            className="btn btn-ghost"
            style={{ gap: 6 }}
          >
            <IconEye size={13} />
            <span>Read</span>
          </Link>
        }
      />

      <div className="main-body" style={{ position: "relative" }}>
        <div ref={scrollRef} className="doc-scroll" style={{ position: "relative" }}>
          <article className="doc-col">
            {/* The doc's identity, inline with the doc rather than in a band
                under the top bar. The only place this screen states status. */}
            <DocMetaRow doc={doc} version={version} />

            {/* A textarea, not an input: at 44px a real title runs past the
                column, and an input clips it mid-word with no way to see the
                rest. Rows grow with the text; Enter still moves to the body. */}
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              onChange={(e) => setTitle(singleLine(e.target.value))}
              onBlur={(e) => saveTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editor?.chain().focus("start").run();
                }
              }}
              placeholder="Untitled"
              className="ed2-title-input"
              style={{
                width: "100%",
                border: 0,
                background: "transparent",
                outline: "none",
                resize: "none",
                overflow: "hidden",
                display: "block",
                fontFamily: "var(--font-serif)",
                fontWeight: 400,
                fontSize: 44,
                lineHeight: 1.1,
                color: "var(--text-primary)",
                padding: 0,
              }}
            />

            {/* No "Started … · Saved just now" line here: the breadcrumb
                already carries the save state, and repeating it under the
                title was one of the three places this screen used to say the
                same thing. */}
            <div style={{ height: 36 }} />

            {images.error && (
              <div
                role="alert"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 18,
                  padding: "10px 14px",
                  background: "var(--review-bg)",
                  border: "1px solid var(--review-border)",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "var(--review-text)",
                }}
              >
                <span style={{ flex: 1 }}>{images.error}</span>
                <button
                  type="button"
                  onClick={images.dismissError}
                  style={{
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: "inherit",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}

            <EditorContent editor={editor} />
          </article>

          {editor && (
            <>
              <SlashMenu
                editor={editor}
                containerRef={scrollRef}
                keyRegistry={keyRegistry}
                workspaceId={doc.workspace_id}
                docId={doc.id}
                base={base}
                onAskAgent={askAgent}
                onInsertImage={images.pickAndInsert}
              />
              <TableControls editor={editor} containerRef={scrollRef} />
              <SelectionToolbar
                editor={editor}
                containerRef={scrollRef}
                keyRegistry={keyRegistry}
                workspaceId={doc.workspace_id}
                docId={doc.id}
                docTitle={title}
                base={base}
              />
            </>
          )}
        </div>

        {/* Right rail — outline, corpus matches, standing consistency check */}
        {editor && (
          <EditorRail
            editor={editor}
            docTitle={title}
            docType={doc.type}
            workspaceId={doc.workspace_id}
            docId={doc.id}
            base={base}
          />
        )}

        {/* The editor's one floating affordance. The workspace-wide Ask pill
            stands down on this route (see AqliChatWidget), so only this one
            ever occupies the corner. */}
        {editor && (
          <FloatingAssistant
            mode="cowrite"
            open={chatOpen}
            onToggle={setChatOpen}
            editor={editor}
            workspaceId={doc.workspace_id}
            docId={doc.id}
            docTitle={title}
            base={base}
            prefill={chatPrefill}
            onPrefillConsumed={() => setChatPrefill(null)}
          />
        )}
      </div>

      <ProcessStrip doc={doc} base={base} ownerName={ownerName} reviewers={reviewers} />
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import AppTopBar from "@/components/layout/AppTopBar";
import { TypeBadge } from "@/components/aqli/badges";
import DocStatusControl from "@/components/docs/DocStatusControl";
import SlashMenu from "@/components/editor/v2/SlashMenu";
import SelectionToolbar from "@/components/editor/v2/SelectionToolbar";
import EditorRail from "@/components/editor/v2/EditorRail";
import CowriteChat from "@/components/editor/v2/CowriteChat";
import ProcessStrip from "@/components/editor/v2/ProcessStrip";
import { IconLink } from "@/components/aqli/icons";
import type { KeyHandlerRegistry } from "@/components/editor/v2/types";
import { tiptapToMarkdown } from "@/lib/markdown/tiptap-to-md";
import { typeLabel } from "@/lib/doc-display";
import { formatDate, formatRelative, avatarColor } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

export default function DocEditorClient({
  doc,
  workspaceSlug,
  version,
  ownerName,
}: {
  doc: DocWithSpace;
  workspaceSlug: string;
  version: number;
  ownerName: string | null;
}) {
  const base = `/w/${workspaceSlug}`;
  const [title, setTitle] = useState(doc.title);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
      }),
      Placeholder.configure({
        placeholder: "Start writing — type / for commands…",
      }),
    ],
    content: doc.body_json ?? { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as Record<string, unknown>;
      // Queue immediately (arms the unload warning during the debounce
      // window); the timer only decides when the pump sends it.
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
    },
  });

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
    (newTitle: string) => {
      if (newTitle === doc.title) return;
      // Through the same queue so a title PUT can't race a body PUT.
      queueUpdates({ title: newTitle || "Untitled" });
      void pumpSaves();
    },
    [queueUpdates, pumpSaves, doc.title],
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

  const savedLabel = saving
    ? "Saving…"
    : saveError
      ? "Couldn't save — retrying on next edit"
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
      />

      <EditorMetaBar
        doc={doc}
        ownerName={ownerName}
        version={version}
      />

      <div className="main-body" style={{ position: "relative" }}>
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            background: "var(--bg-base)",
            position: "relative",
          }}
        >
          <article
            className="ed2-article"
            style={{
              maxWidth: 720,
              margin: "0 auto",
              padding: "56px 40px 120px",
            }}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
                fontFamily: "var(--font-serif)",
                fontWeight: 400,
                fontSize: 44,
                lineHeight: 1.1,
                color: "var(--text-primary)",
                padding: 0,
              }}
            />

            <div
              style={{
                marginTop: 8,
                marginBottom: 36,
                fontSize: 13.5,
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span suppressHydrationWarning>Started {formatDate(doc.created_at)}</span>
              <span>·</span>
              <span>{savedLabel}</span>
            </div>

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
              />
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

        {/* Right rail — structural context */}
        {editor && (
          <EditorRail
            editor={editor}
            docTitle={title}
            workspaceId={doc.workspace_id}
            docId={doc.id}
            base={base}
          />
        )}

        {/* Floating Co-write chat */}
        {editor && (
          <CowriteChat
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

      <ProcessStrip doc={doc} base={base} ownerName={ownerName} savedLabel={savedLabel} />
    </>
  );
}

function EditorMetaBar({
  doc,
  ownerName,
  version,
}: {
  doc: DocWithSpace;
  ownerName: string | null;
  version: number;
}) {
  const tags = doc.frontmatter?.tags ?? [];
  const linkedLabel =
    doc.frontmatter?.linear_issue_id ??
    doc.frontmatter?.linear_project_id ??
    (doc.frontmatter?.linked_project_url ? "Linked project" : null);

  return (
    <div
      style={{
        height: 44,
        flex: "0 0 44px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 40px",
        gap: 18,
        background: "var(--bg-base)",
        fontSize: 12.5,
        overflow: "hidden",
      }}
    >
      <MetaField label="Type">
        <TypeBadge type={typeLabel(doc.type)} />
      </MetaField>
      <MetaField label="Status">
        <DocStatusControl docId={doc.id} status={doc.status} />
      </MetaField>
      <MetaField label="Owner">
        {ownerName ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="avatar avatar-sm" style={{ background: avatarColor(ownerName) }}>
              {ownerName.charAt(0).toUpperCase()}
            </span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              {ownerName}
            </span>
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>Unassigned</span>
        )}
      </MetaField>
      {linkedLabel && (
        <MetaField label="Linear">
          <a
            href={doc.frontmatter?.linked_project_url ?? "#"}
            target={doc.frontmatter?.linked_project_url ? "_blank" : undefined}
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: "var(--accent)",
              fontWeight: 500,
              textDecoration: "none",
              maxWidth: 230,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            <IconLink size={12} />
            {linkedLabel}
          </a>
        </MetaField>
      )}
      {tags.length > 0 && (
        <MetaField label="Tags">
          <span style={{ display: "inline-flex", gap: 4, minWidth: 0 }}>
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </span>
        </MetaField>
      )}
      <div
        style={{
          marginLeft: "auto",
          color: "var(--text-muted)",
          fontSize: 12,
          whiteSpace: "nowrap",
        }}
      >
        v{version} · Last reviewed{" "}
        {doc.last_reviewed_at ? formatDate(doc.last_reviewed_at) : "not yet"}
      </div>
    </div>
  );
}

function MetaField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <span
        style={{
          color: "var(--text-muted)",
          fontSize: 11.5,
          textTransform: "uppercase",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

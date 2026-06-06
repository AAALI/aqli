"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import AqliEditor from "@/components/editor/AqliEditor";
import DocMeta from "@/components/docs/DocMeta";
import DownloadMarkdownButton from "@/components/docs/DownloadMarkdownButton";
import type { Doc } from "@/types/doc";

export default function DocEditorClient({
  doc,
  workspaceSlug,
}: {
  doc: Doc;
  workspaceSlug: string;
}) {
  const [title, setTitle] = useState(doc.title);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ body_md: string; title: string }>({
    body_md: doc.body_md ?? "",
    title: doc.title,
  });

  const persist = useCallback(
    async (updates: Record<string, unknown>) => {
      setSaving(true);
      try {
        await fetch(`/api/docs/${doc.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        setLastSaved(new Date());
      } finally {
        setSaving(false);
      }
    },
    [doc.id],
  );

  const onBodyChange = useCallback(
    (json: Record<string, unknown>, markdown: string) => {
      latest.current.body_md = markdown;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persist({ body_json: json, body_md: markdown });
      }, 2000); // 2s debounce
    },
    [persist],
  );

  const saveTitle = useCallback(
    (newTitle: string) => {
      if (newTitle === doc.title) return;
      persist({ title: newTitle || "Untitled" });
    },
    [persist, doc.title],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-8 py-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={(e) => saveTitle(e.target.value)}
          className="w-full border-none bg-transparent text-2xl font-semibold outline-none"
          placeholder="Untitled"
        />
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-neutral-400">
            {saving
              ? "Saving…"
              : lastSaved
                ? `Saved ${lastSaved.toLocaleTimeString()}`
                : ""}
          </span>
          <DownloadMarkdownButton doc={doc} />
          <Link
            href={`/w/${workspaceSlug}/docs/${doc.id}`}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
          >
            Done
          </Link>
        </div>
      </div>

      <DocMeta doc={doc} />

      <div className="flex-1 overflow-hidden">
        <AqliEditor initialContent={doc.body_json} onChange={onBodyChange} />
      </div>
    </div>
  );
}

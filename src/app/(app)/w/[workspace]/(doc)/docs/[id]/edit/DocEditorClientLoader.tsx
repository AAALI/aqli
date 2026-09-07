"use client";

import dynamic from "next/dynamic";
import type React from "react";

/**
 * Loads the document editor without putting Tiptap in the Cloudflare worker.
 *
 * Same reasoning as `components/docs/DocBodyClient.tsx`: `DocEditorClient`
 * mounts Tiptap with `immediatelyRender: false`, so the server pass renders
 * nothing — but the module graph still dragged ProseMirror and the whole
 * markdown schema into the worker, ~450 KiB per route, against a 3 MiB budget.
 *
 * `ssr: false` has to be set inside a Client Component; Next 16 rejects it in a
 * Server Component. That is the only reason this file exists.
 */
const DocEditorClient = dynamic(() => import("./DocEditorClient"), {
  ssr: false,
  // The skeleton is the paper column at its real measure — a title bar and
  // three text bars, in the place the words will appear. Never a spinner over
  // the writing surface (§4).
  loading: () => (
    <div aria-hidden className="doc-scroll">
      <div className="doc-col">
        <div style={{ height: 40, width: "62%", borderRadius: 5, background: "var(--bg-sidebar)" }} />
        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 14 }}>
          {[100, 96, 74].map((w, i) => (
            <div
              key={i}
              style={{ height: 14, width: `${w}%`, borderRadius: 4, background: "var(--bg-sidebar)" }}
            />
          ))}
        </div>
      </div>
    </div>
  ),
});

export default function DocEditorClientLoader(props: React.ComponentProps<typeof import('./DocEditorClient').default>) {
  return <DocEditorClient {...props} />;
}

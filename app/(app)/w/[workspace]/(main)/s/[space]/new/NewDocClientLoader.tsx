"use client";

import dynamic from "next/dynamic";
import type React from "react";

/**
 * Loads the new-document editor without putting Tiptap in the Cloudflare worker.
 *
 * Same reasoning as `components/docs/DocBodyClient.tsx`: `NewDocClient`
 * mounts Tiptap with `immediatelyRender: false`, so the server pass renders
 * nothing — but the module graph still dragged ProseMirror and the whole
 * markdown schema into the worker, ~450 KiB per route, against a 3 MiB budget.
 *
 * `ssr: false` has to be set inside a Client Component; Next 16 rejects it in a
 * Server Component. That is the only reason this file exists.
 */
const NewDocClient = dynamic(() => import("./NewDocClient"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "40px 56px",
      }}
    >
      {[40, 100, 92, 96, 60].map((w, i) => (
        <div
          key={i}
          style={{
            height: i === 0 ? 34 : 13,
            width: `${w}%`,
            borderRadius: 4,
            background: "var(--bg-card)",
          }}
        />
      ))}
    </div>
  ),
});

export default function NewDocClientLoader(props: React.ComponentProps<typeof import('./NewDocClient').default>) {
  return <NewDocClient {...props} />;
}

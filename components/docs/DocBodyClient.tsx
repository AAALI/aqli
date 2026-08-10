"use client";

import dynamic from "next/dynamic";

/**
 * Loads the doc body without putting the editor in the server bundle.
 *
 * `DocBody` mounts Tiptap, and Tiptap's schema (`lib/markdown/schema.ts`) pulls
 * in every allowlisted extension plus ProseMirror. That is ~450 KiB per route
 * that touches it, and Cloudflare's Workers limit is 3 MiB gzipped for the
 * whole app — measured, three near-identical copies of it were in the worker,
 * one for each route tree that renders a document.
 *
 * They were rendering nothing. `DocBody` sets `immediatelyRender: false`, which
 * is required for SSR correctness with Tiptap, and means the server pass emits
 * an empty container and the real content appears on hydration. So the worker
 * carried a rich-text editor in order to produce `<div></div>`.
 *
 * `ssr: false` states that directly: never render this on the server, and
 * therefore never bundle it there. It has to live in a Client Component —
 * Next 16 rejects the option in a Server Component (see
 * `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`), which is the
 * only reason this wrapper exists.
 *
 * **Keep this file's imports empty of anything heavy.** This component *is*
 * server-rendered; only its dynamic child is exempt. Importing the markdown
 * pipeline here — to convert `body_md` before passing it down, say — would put
 * the schema straight back into the worker. The conversion happens inside
 * `DocBody` for exactly that reason.
 */
const DocBody = dynamic(() => import("./DocBody"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}
    >
      {[100, 92, 96, 60].map((w, i) => (
        <div
          key={i}
          style={{
            height: 13,
            width: `${w}%`,
            borderRadius: 4,
            background: "var(--bg-card)",
          }}
        />
      ))}
    </div>
  ),
});

export default function DocBodyClient({
  bodyMd,
  title,
}: {
  /** Canonical markdown. Parsed in the browser, by `DocBody`. */
  bodyMd: string | null;
  title?: string;
}) {
  return <DocBody bodyMd={bodyMd} title={title} />;
}

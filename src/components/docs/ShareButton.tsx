"use client";

import { useState } from "react";

/**
 * Share is copying the link. Everyone who can see the doc already can, so
 * there is nothing to configure — a permissions dialog here would be process
 * on the reading surface.
 */
export default function ShareButton() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard refused (insecure context, permissions): leave the label.
        }
      }}
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}

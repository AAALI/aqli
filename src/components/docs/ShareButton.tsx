"use client";

import { useState } from "react";

/**
 * Share is copying the link. Everyone who can see the doc already can, so
 * there is nothing to configure — a permissions dialog here would be process
 * on the reading surface.
 */
export default function ShareButton() {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost"
      title={failed ? "Could not copy the link. Try again, or copy it from your browser's address bar." : undefined}
      aria-live="polite"
      onClick={async () => {
        setFailed(false);
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setFailed(true);
        }
      }}
    >
      {copied ? "Link copied" : failed ? "Retry copy" : "Share"}
    </button>
  );
}

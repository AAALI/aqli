"use client";

import { useState } from "react";
import Link from "next/link";
import { IconChat, IconEdit, IconShare } from "@/components/aqli/icons";

/**
 * Reading on a phone (frame 13): the doc gets the screen, and every control
 * collapses into one bar at the bottom — Outline, Ask, Edit, Share. Outline
 * and Ask open the same rail and panel the desktop uses, by event, so there
 * is still one of each. Hidden by CSS above 767px.
 */
export default function PhoneReadBar({ editHref }: { editHref: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <nav className="pbar-read" aria-label="Doc actions">
      <button type="button" className="btn btn-ghost" onClick={() => window.dispatchEvent(new CustomEvent("aqli:open-rail"))}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h10M4 18h13" />
        </svg>
        Outline
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => window.dispatchEvent(new CustomEvent("aqli:open-ask"))}>
        <IconChat size={15} />
        Ask
      </button>
      {editHref && (
        <Link href={editHref} className="btn btn-ghost">
          <IconEdit size={15} />
          Edit
        </Link>
      )}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => {
          try {
            if (navigator.share) await navigator.share({ url: window.location.href, title: document.title });
            else {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }
          } catch {
            // Share sheet dismissed.
          }
        }}
      >
        <IconShare size={15} />
        {copied ? "Copied" : "Share"}
      </button>
    </nav>
  );
}

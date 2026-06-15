"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconSparkle } from "@/components/aqli/icons";
import { formatRelative } from "@/lib/utils";

type ChangeEntry = {
  version_number: number;
  change_type: "edit" | "status_change" | "created";
  created_at: string;
};

const LABEL: Record<ChangeEntry["change_type"], string> = {
  edit: "Edited",
  status_change: "Status changed",
  created: "Created",
};

/**
 * "What changed since you last read this" — a returning reader shouldn't have
 * to re-read the whole doc. Summarises the most recent version-history entries.
 * Dismissal is remembered per (doc, version) so it reappears only on real change.
 */
export default function WhatChangedBanner({
  docId,
  currentVersion,
  historyHref,
  changes,
}: {
  docId: string;
  currentVersion: number;
  historyHref: string;
  changes: ChangeEntry[];
}) {
  const storageKey = `aqli:whatchanged:${docId}`;
  const [hidden, setHidden] = useState(true);

  // Start hidden on the server and first client render to avoid a hydration
  // mismatch, then reveal once we can read the per-version dismissal flag.
  useEffect(() => {
    const dismissedAt = Number(localStorage.getItem(storageKey) ?? 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage post-hydration is the SSR-safe pattern
    setHidden(dismissedAt >= currentVersion);
  }, [storageKey, currentVersion]);

  if (hidden || changes.length === 0) return null;

  function dismiss() {
    localStorage.setItem(storageKey, String(currentVersion));
    setHidden(true);
  }

  return (
    <div
      style={{
        marginTop: 22,
        padding: "14px 18px",
        background: "var(--accent-light)",
        border: "1px solid rgba(15,110,86,0.20)",
        borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: "var(--accent)", display: "inline-flex" }}>
          <IconSparkle size={13} />
        </span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--accent)",
          }}
        >
          What changed in v{currentVersion}
        </span>
        <button
          onClick={dismiss}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: 0,
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
          }}
        >
          Hide
        </button>
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 18,
          fontSize: 13.5,
          lineHeight: 1.65,
          color: "var(--text-primary)",
        }}
      >
        {changes.map((c) => (
          <li key={c.version_number}>
            {LABEL[c.change_type]}{" "}
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              · v{c.version_number} · {formatRelative(c.created_at)}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href={historyHref}
        style={{
          display: "inline-block",
          marginTop: 8,
          fontSize: 12,
          color: "var(--accent)",
          textDecoration: "none",
        }}
      >
        See full history →
      </Link>
    </div>
  );
}

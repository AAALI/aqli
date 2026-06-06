"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/aqli/badges";
import { IconChevDown, IconCheck } from "@/components/aqli/icons";
import { statusLabel } from "@/lib/doc-display";
import type { DocStatus } from "@/types/doc";

const ORDER: DocStatus[] = ["draft", "review", "approved", "stale", "archived"];

export default function DocStatusControl({
  docId,
  status,
}: {
  docId: string;
  status: DocStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function setStatus(next: DocStatus) {
    setOpen(false);
    if (next === status) return;
    setBusy(true);
    try {
      await fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 28,
          padding: "0 10px 0 8px",
          borderRadius: 6,
          background: "transparent",
          border: "1px solid transparent",
          cursor: "pointer",
        }}
      >
        <StatusBadge status={statusLabel(status)} />
        <span style={{ color: "var(--text-muted)" }}><IconChevDown size={12} /></span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: 34,
            left: 0,
            minWidth: 180,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.14)",
            padding: 6,
            zIndex: 60,
          }}
        >
          {ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "7px 8px",
                borderRadius: 6,
                background: "transparent",
                border: 0,
                cursor: "pointer",
                fontSize: 13,
                color: "var(--text-primary)",
                fontFamily: "var(--font-sans)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ width: 14, display: "inline-flex", color: "var(--accent)" }}>
                {s === status && <IconCheck size={13} />}
              </span>
              <StatusBadge status={statusLabel(s)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

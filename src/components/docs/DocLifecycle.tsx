"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Putting a document away: discard a draft, archive a page, restore it, delete
 * it for good.
 *
 * Each destructive button asks once, in place — the button becomes the
 * question and the choice sits next to it. No modal: these live inside list
 * rows and top bars, and a dialog for one yes/no is more process than the
 * decision deserves. Clicks never reach the row's link underneath.
 */

type Props = {
  docId: string;
  /** Where to go afterwards; refreshes the current page when omitted. */
  redirectTo?: string;
  size?: "sm" | "md";
};

function stop(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function useAction(redirectTo?: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(url: string, method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method }).catch(() => null);
    if (!res || !res.ok) {
      const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      setError(body.error ?? "That didn't work. Try again.");
      setBusy(false);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }
  return { busy, error, run };
}

function Confirm({
  label,
  question,
  confirmLabel,
  busyLabel,
  danger,
  skipConfirm,
  size = "sm",
  onConfirm,
  busy,
  error,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  busyLabel: string;
  danger?: boolean;
  skipConfirm?: boolean;
  size?: "sm" | "md";
  onConfirm: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [asking, setAsking] = useState(false);
  const sm = size === "sm" ? " btn-sm" : "";
  const tone = danger ? " btn-ghost-danger" : "";

  if (busy) {
    return (
      <button type="button" className={`btn btn-ghost${sm}`} disabled onClick={stop}>
        {busyLabel}
      </button>
    );
  }
  if (!asking) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {error && <span role="alert" style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</span>}
        <button
          type="button"
          className={`btn btn-ghost${sm}${tone}`}
          onClick={(e) => {
            stop(e);
            if (skipConfirm) onConfirm();
            else setAsking(true);
          }}
        >
          {label}
        </button>
      </span>
    );
  }
  return (
    <span
      role="group"
      aria-label={question}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
      onClick={stop}
    >
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{question}</span>
      <button
        type="button"
        className={`btn btn-secondary${sm}${tone}`}
        autoFocus
        onClick={(e) => {
          stop(e);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        className={`btn btn-ghost${sm}`}
        onClick={(e) => {
          stop(e);
          setAsking(false);
        }}
      >
        Cancel
      </button>
    </span>
  );
}

/** Throw a draft away. An empty one goes without asking: there is nothing to lose. */
export function DiscardDraftButton({ docId, redirectTo, size, empty = false }: Props & { empty?: boolean }) {
  const { busy, error, run } = useAction(redirectTo);
  return (
    <Confirm
      label="Discard"
      question="Discard this draft for good?"
      confirmLabel="Discard"
      busyLabel="Discarding…"
      danger
      skipConfirm={empty}
      size={size}
      busy={busy}
      error={error}
      onConfirm={() => run(`/api/docs/${docId}`, "DELETE")}
    />
  );
}

/** Put a published page away. Its sub-pages go with it; nothing is destroyed. */
export function ArchiveButton({ docId, redirectTo, size, hasSubPages = false }: Props & { hasSubPages?: boolean }) {
  const { busy, error, run } = useAction(redirectTo);
  const question = hasSubPages ? "Archive this page and the pages under it?" : "Archive this page?";
  return (
    <Confirm
      label="Archive"
      question={question}
      confirmLabel="Archive"
      busyLabel="Archiving…"
      size={size}
      busy={busy}
      error={error}
      onConfirm={() => run(`/api/docs/${docId}/archive`, "POST")}
    />
  );
}

export function RestoreButton({ docId, redirectTo, size }: Props) {
  const { busy, error, run } = useAction(redirectTo);
  return (
    <Confirm
      label="Restore"
      question=""
      confirmLabel="Restore"
      busyLabel="Restoring…"
      skipConfirm
      size={size}
      busy={busy}
      error={error}
      onConfirm={() => run(`/api/docs/${docId}/archive`, "DELETE")}
    />
  );
}

/** The one that cannot be undone. Offered only on archived pages. */
export function DeleteForeverButton({ docId, redirectTo, size }: Props) {
  const { busy, error, run } = useAction(redirectTo);
  return (
    <Confirm
      label="Delete permanently"
      question="Delete it and its history? This can't be undone."
      confirmLabel="Delete"
      busyLabel="Deleting…"
      danger
      size={size}
      busy={busy}
      error={error}
      onConfirm={() => run(`/api/docs/${docId}`, "DELETE")}
    />
  );
}

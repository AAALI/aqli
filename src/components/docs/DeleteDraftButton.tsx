"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Delete an empty draft (frame 15). Offered only on drafts with nothing in
 * them, where there is nothing to lose — a draft with words in it offers
 * "Keep writing" instead.
 */
export default function DeleteDraftButton({ docId }: { docId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm btn-ghost"
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        setBusy(true);
        await fetch(`/api/docs/${docId}`, { method: "DELETE" }).catch(() => null);
        router.refresh();
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}

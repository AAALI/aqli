"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Status from "./Status";
import { avatarColor } from "@/lib/utils";
import type { Trust } from "@/lib/trust";

const ACTION_LABEL = {
  confirm: "Confirm it's still true",
  reverify: "Re-verify",
  nudge: "Nudge",
} as const;

/**
 * The trust line (v3 §2): the state, then why.
 *
 * `Current · checked by Sara, 5 days ago`. This line is the entire
 * maintenance UI on the reading surface. Its one action is hidden until the
 * line is hovered or focused — reachable by keyboard, invisible to someone
 * who is only reading.
 */
export default function TrustLine({ docId, trust }: { docId: string; trust: Trust }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function act() {
    if (!trust.action) return;
    setBusy(true);
    try {
      const res = await fetch(
        trust.action === "nudge" ? `/api/docs/${docId}/nudge` : `/api/docs/${docId}/reviewed`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error();
      if (trust.action === "nudge") setDone("Nudged");
      router.refresh();
    } catch {
      setDone("Didn't go through — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tline">
      <Status state={trust.state} />
      <span className="who">
        {trust.lead}
        {trust.person && (
          <>
            {" "}
            <span
              className="avatar"
              aria-hidden
              style={{ width: 20, height: 20, flexBasis: 20, fontSize: 9, background: avatarColor(trust.person) }}
            >
              {trust.person.charAt(0).toUpperCase()}
            </span>
            {trust.person}
          </>
        )}
        {trust.tail}
      </span>
      {trust.action && (
        <span className={`re${done ? " is-pinned" : ""}`}>
          {done ? (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{done}</span>
          ) : (
            <button
              type="button"
              className={`btn btn-sm ${trust.action === "confirm" ? "btn-primary" : "btn-secondary"}`}
              onClick={act}
              disabled={busy}
            >
              {busy ? "…" : ACTION_LABEL[trust.action]}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

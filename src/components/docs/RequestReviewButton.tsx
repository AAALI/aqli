"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@/components/aqli/icons";

export default function RequestReviewButton({ docId }: { docId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      await fetch(`/api/docs/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "review" }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary" style={{ gap: 6 }} onClick={() => setOpen(true)}>
        <IconCheck size={13} sw={2.2} />
        <span>Request review</span>
      </button>

      {open && (
        <div className="aqli-overlay" onClick={() => setOpen(false)}>
          <div
            className="aqli-modal"
            style={{ maxWidth: 520, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em" }}>
                Request review
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Reviewers can approve, request changes, or reject. This snapshot becomes the next version.
              </p>
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tell reviewers where to focus…"
                style={{
                  minHeight: 90,
                  padding: "10px 12px",
                  background: "var(--bg-base)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13.5,
                  color: "var(--text-primary)",
                  lineHeight: 1.55,
                  fontFamily: "var(--font-sans)",
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </label>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Doc moves from <strong style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Draft</strong> to{" "}
                <strong style={{ color: "var(--review-text)", fontWeight: 500 }}>In Review</strong>.
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={send} disabled={busy}>
                  {busy ? "Sending…" : "Send for review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

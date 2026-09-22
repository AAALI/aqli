"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconRobot, IconCheckCircle } from "@/components/aqli/icons";
import { avatarColor, formatRelative } from "@/lib/utils";
import { listNames } from "@/lib/trust";

export type CheckItem =
  | {
      kind: "doc";
      id: string;
      title: string;
      space: string | null;
      minutes: number;
      askedAt: string;
      asker: string | null;
      askedYou: boolean;
      others: string[];
      changes: string[];
      changedFrom: number | null;
      excerpt: string;
    }
  | {
      kind: "agent";
      id: string;
      title: string;
      space: string | null;
      minutes: number;
      askedAt: string;
      agent: string;
      isAgent: boolean;
      excerpt: string;
      changes: string[];
      body: string;
    };

const NUMBERS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things", "Six things", "Seven things", "Eight things", "Nine things", "Ten things"];
const MINUTES = ["", "a minute", "two minutes", "three minutes", "four minutes", "five minutes", "six minutes", "seven minutes", "eight minutes", "nine minutes", "ten minutes"];

/** What the merge engine's refusals mean to the person confirming. */
const MERGE_ERRORS: Record<string, string> = {
  stale_base: "The doc changed since this was written. Confirming it would undo the newer change — send it back instead.",
  proposal_not_open: "Someone else got here first, or a newer change replaced this one.",
  forbidden: "You need editor or admin rights to confirm changes.",
  document_not_found: "The doc this change was for no longer exists.",
};

export default function ChecksClient({ items, base }: { items: CheckItem[]; base: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reading, setReading] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const total = items.reduce((n, i) => n + i.minutes, 0);
  const headline = items.length === 0 ? "Nothing to confirm." : `${NUMBERS[items.length] ?? `${items.length} things`} to confirm.`;
  const sub =
    items.length === 0
      ? "When someone asks you to check a doc, or an agent writes one, it lands here."
      : `Reading time${items.length > 1 ? ", all together" : ""}: about ${MINUTES[total] ?? `${total} minutes`}.`;

  async function post(key: string, url: string, body?: unknown) {
    setBusy(key);
    setErrors((e) => ({ ...e, [key]: "" }));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { error?: string };
        setErrors((e) => ({ ...e, [key]: MERGE_ERRORS[b.error ?? ""] ?? b.error ?? "That didn't go through. Try again." }));
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="wrap">
      <div style={{ maxWidth: 760 }}>
        <h1 className="h1">{headline}</h1>
        <p className="h1s">{sub}</p>

        {items.map((item, i) => (
          <div
            key={item.id}
            className="card"
            style={{
              marginTop: i === 0 ? 26 : 16,
              padding: "18px 20px",
              ...(item.kind === "agent" ? { borderLeft: "3px solid var(--ageing-border)" } : {}),
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              {item.kind === "agent" ? (
                <span
                  className="avatar avatar-lg"
                  aria-hidden
                  style={{ width: 34, height: 34, flexBasis: 34, background: "var(--ageing-bg)", color: "var(--ageing-text)", border: "1px solid var(--ageing-border)" }}
                >
                  <IconRobot size={15} />
                </span>
              ) : (
                <span
                  className="avatar avatar-lg"
                  aria-hidden
                  style={{ width: 34, height: 34, flexBasis: 34, fontSize: 12.5, background: avatarColor(item.asker ?? "?") }}
                >
                  {(item.asker ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                  {item.kind === "agent" ? (
                    <>
                      <b style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.agent}</b>{" "}
                      {item.isAgent ? "wrote this and is waiting for a person to confirm it." : "proposed this change."}
                    </>
                  ) : item.askedYou ? (
                    <>
                      <b style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.asker ?? "Someone"}</b> wants you to
                      check this before it counts as true.
                    </>
                  ) : (
                    <>
                      <b style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.asker ?? "Someone"}</b>{" "}
                      {item.others.length ? `asked ${listNames(item.others)} to check this.` : "wants this checked."}
                    </>
                  )}
                </p>
                <p style={{ margin: "9px 0 0", fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em" }}>
                  {item.title}
                </p>
                <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
                  {[item.space, `${item.minutes} min read`, `${item.kind === "agent" ? "" : "asked "}${formatRelative(item.askedAt)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {item.changes.length > 0 ? (
                  <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 9 }}>
                    <p className="eyebrow-s" style={{ margin: "0 0 8px", letterSpacing: "0.11em" }}>
                      {item.kind === "doc" && item.changedFrom ? `What's different from v${item.changedFrom}` : "What it changes"}
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                      {item.changes.map((c, j) => (
                        <li key={j}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : item.excerpt ? (
                  <div style={{ marginTop: 16, padding: "14px 16px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 9, fontFamily: "var(--font-serif)", fontSize: 14.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                    “{item.excerpt}”
                  </div>
                ) : null}

                {item.kind === "agent" && reading === item.id && (
                  <div className="dbody" style={{ marginTop: 16, padding: "4px 2px 0", fontSize: 16, whiteSpace: "pre-wrap" }}>
                    {item.body}
                  </div>
                )}

                {errors[item.id] && (
                  <p role="alert" style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--ageing-text)" }}>
                    {errors[item.id]}
                  </p>
                )}

                {sending === item.id ? (
                  <form
                    style={{ marginTop: 16, display: "flex", gap: 9 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (note.trim()) void post(item.id, `/api/proposals/${item.id}`, { action: "reject", note: note.trim() });
                    }}
                  >
                    <input
                      autoFocus
                      className="inp"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What should change before it's ready?"
                      aria-label="What should change"
                    />
                    <button type="submit" className="btn btn-primary" disabled={!note.trim() || busy === item.id}>
                      Send back
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setSending(null)}>
                      Cancel
                    </button>
                  </form>
                ) : (
                <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  {item.kind === "doc" ? (
                    <>
                      <Link href={`${base}/docs/${item.id}`} className="btn btn-primary">
                        Read it, then confirm
                      </Link>
                      <Link href={`${base}/docs/${item.id}#doc-comments`} className="btn btn-secondary">
                        Comment instead
                      </Link>
                      <span style={{ flex: 1 }} />
                      {item.askedYou && (
                        <button type="button" className="btn btn-ghost" disabled={busy === item.id} onClick={() => post(item.id, `/api/docs/${item.id}/decline`)}>
                          Not my call
                        </button>
                      )}
                    </>
                  ) : reading === item.id ? (
                    <>
                      <button type="button" className="btn btn-primary" disabled={busy === item.id} onClick={() => post(item.id, `/api/proposals/${item.id}`, { action: "approve" })}>
                        {busy === item.id ? "Confirming…" : "Confirm it"}
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={() => setReading(null)}>
                        Close
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-primary" onClick={() => setReading(item.id)}>
                        Read it, then confirm
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={busy === item.id} onClick={() => { setSending(item.id); setNote(""); }}>
                        Send it back
                      </button>
                      <span style={{ flex: 1 }} />
                      <button type="button" className="btn btn-ghost" disabled={busy === item.id} onClick={() => post(item.id, `/api/proposals/${item.id}`, { action: "reject", note: "Deleted from Checks." })}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <p className="hint" style={{ marginTop: 28 }}>
          <IconCheckCircle size={13} /> Docs written from a merged pull request publish themselves — they never land here.{" "}
          <Link href={`${base}/settings/integrations/github`} style={{ color: "var(--accent)", textDecoration: "none" }}>
            Change that
          </Link>
        </p>
      </div>
    </div>
  );
}

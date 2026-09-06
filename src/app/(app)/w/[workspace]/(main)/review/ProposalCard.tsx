"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TypeBadge, AgentChip } from "@/components/aqli/badges";
import { IconArrowUpRight } from "@/components/aqli/icons";
import { typeLabel } from "@/lib/doc-display";
import { formatRelative } from "@/lib/utils";
import { diffLines, diffStat, collapseContext } from "@/lib/merge/diff";
import type { ProposalWithContext } from "@/types/proposal";

type Props = {
  proposal: ProposalWithContext;
  base: string;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
  onReject: (note: string) => void;
};

/**
 * One open proposal in the review queue.
 *
 * A reviewer is approving a *change*, not a document, so the card leads with
 * what the change does to the body. For a proposal that creates a document
 * there is nothing to compare against, and the body is shown whole.
 */
export default function ProposalCard({
  proposal,
  base,
  busy,
  error,
  onApprove,
  onReject,
}: Props) {
  const [showDiff, setShowDiff] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  const isNew = !proposal.document_id;
  const before = proposal.document?.body_md ?? "";

  const { lines, stat } = useMemo(() => {
    const full = diffLines(before, proposal.body_md ?? "");
    return { lines: collapseContext(full, 3), stat: diffStat(full) };
  }, [before, proposal.body_md]);

  const author = proposal.agent_key
    ? proposal.agent_key.name
    : proposal.frontmatter?.agent_id ??
      (proposal.frontmatter?.origin === "system" ? "Integration" : null);

  const titleChanged =
    !isNew && proposal.document && proposal.document.title !== proposal.title;

  return (
    <div
      className="card"
      style={{ overflow: "hidden", borderLeft: "3px solid var(--review-text)" }}
    >
      <div
        style={{
          padding: "20px 24px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
                flexWrap: "wrap",
              }}
            >
              <AgentChip
                label={proposal.agent_key_id ? "Agent authored" : "Human authored"}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: "var(--review-bg)",
                  color: "var(--review-text)",
                }}
              >
                {isNew ? "New document" : "Change"}
              </span>
              {proposal.document && (
                <TypeBadge type={typeLabel(proposal.document.type)} />
              )}
              {proposal.space && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  · {proposal.space.name}
                </span>
              )}
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: 16.5,
                fontWeight: 500,
                color: "var(--text-primary)",
                letterSpacing: "-0.005em",
              }}
            >
              {proposal.title}
            </h3>

            {titleChanged && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Renamed from “{proposal.document!.title}”
              </div>
            )}
          </div>

          <span style={{ flexShrink: 0, fontSize: 12, color: "var(--text-muted)" }}>
            {formatRelative(proposal.created_at)}
          </span>
        </div>

        {proposal.rationale && (
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "var(--text-secondary)",
            }}
          >
            {proposal.rationale}
          </p>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 12.5,
            color: "var(--text-muted)",
          }}
        >
          {isNew ? (
            <span>
              {(proposal.body_md ?? "").split("\n").length} lines, nothing to compare
              against yet
            </span>
          ) : (
            <span>
              <span style={{ color: "var(--approved-text)" }}>+{stat.added}</span>{" "}
              <span style={{ color: "var(--stale-text)" }}>−{stat.removed}</span>
            </span>
          )}
          {author && (
            <span>
              by <span style={{ fontFamily: "var(--font-mono)" }}>{author}</span>
            </span>
          )}
          <button
            onClick={() => setShowDiff((v) => !v)}
            className="btn btn-ghost"
            style={{ fontSize: 12.5, padding: "2px 8px" }}
          >
            {showDiff ? "Hide" : isNew ? "Show content" : "Show changes"}
          </button>
        </div>

        {showDiff && (
          <pre
            style={{
              margin: 0,
              maxHeight: 380,
              overflow: "auto",
              background: "var(--bg-subtle, var(--bg-card))",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12.5,
              lineHeight: 1.55,
              fontFamily: "var(--font-mono)",
            }}
          >
            {isNew
              ? (proposal.body_md ?? "")
                  .split("\n")
                  .map((text, i) => (
                    <div key={i} style={{ padding: "0 10px", whiteSpace: "pre-wrap" }}>
                      {text || " "}
                    </div>
                  ))
              : lines.length === 0
                ? (
                    <div style={{ padding: "8px 10px", color: "var(--text-muted)" }}>
                      No change to the body — this proposal only changes the title or
                      frontmatter.
                    </div>
                  )
                : lines.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "0 10px",
                        whiteSpace: "pre-wrap",
                        background:
                          line.op === "add"
                            ? "var(--approved-bg)"
                            : line.op === "remove"
                              ? "var(--stale-bg)"
                              : "transparent",
                        color:
                          line.op === "add"
                            ? "var(--approved-text)"
                            : line.op === "remove"
                              ? "var(--stale-text)"
                              : "var(--text-secondary)",
                      }}
                    >
                      {line.op === "add" ? "+" : line.op === "remove" ? "−" : " "}{" "}
                      {line.text || " "}
                    </div>
                  ))}
          </pre>
        )}

        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--stale-text)",
              background: "var(--stale-bg)",
              padding: "8px 10px",
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingTop: 12,
            borderTop: "1px solid var(--border)",
          }}
        >
          {proposal.document && (
            <Link
              href={`${base}/docs/${proposal.document.id}`}
              target="_blank"
              className="btn btn-ghost"
              style={{ gap: 5, marginRight: "auto", fontSize: 12.5 }}
            >
              <IconArrowUpRight size={13} />
              <span>Read current version</span>
            </Link>
          )}
          {!proposal.document && <span style={{ marginRight: "auto" }} />}

          <button onClick={onApprove} disabled={busy} className="btn btn-primary">
            {busy ? "Approving…" : "Approve"}
          </button>
          <button
            onClick={() => setRejecting((v) => !v)}
            disabled={busy}
            className="btn btn-ghost btn-ghost-danger"
          >
            Reject
          </button>
        </div>
      </div>

      {rejecting && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--stale-bg)",
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: "var(--stale-text)",
              marginBottom: 8,
            }}
          >
            Reason for rejection
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain why this change is being rejected…"
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "var(--bg-card)",
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
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                onReject(note);
                setRejecting(false);
                setNote("");
              }}
              className="btn btn-ghost btn-ghost-danger"
              style={{ background: "var(--stale-bg)" }}
            >
              Confirm Rejection
            </button>
            <button onClick={() => setRejecting(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

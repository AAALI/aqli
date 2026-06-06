"use client";

import { useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/aqli/badges";
import {
  IconRobot,
  IconChat,
  IconReply,
  IconCheck,
  IconX,
  IconWarn,
  IconBell,
} from "@/components/aqli/icons";
import type {
  ReviewDoc,
  AgentTrailEntry,
  ReviewComment,
} from "@/lib/mock/reviews";

type Modal = null | "request" | "approve" | "reject";

export default function ReviewDetailClient({
  doc,
  trail,
  comments,
}: {
  doc: ReviewDoc;
  trail: AgentTrailEntry[];
  comments: ReviewComment[];
}) {
  const [modal, setModal] = useState<Modal>(null);
  const dim = modal !== null;

  return (
    <>
      <ReviewStatusBar doc={doc} />
      <div className="main-body" style={dim ? { opacity: 0.5 } : undefined}>
        <DiffBody doc={doc} comments={comments} />
        <AgentContextRail doc={doc} trail={trail} />
      </div>
      <ReviewActionBar onAction={setModal} />

      {dim && (
        <>
          <div style={{ position: "absolute", inset: 0, background: "rgba(20,20,18,0.32)", zIndex: 50 }} onClick={() => setModal(null)} />
          {modal === "request" && <RequestChangesModal onClose={() => setModal(null)} />}
          {modal === "approve" && <ApproveModal onClose={() => setModal(null)} />}
          {modal === "reject" && <RejectModal onClose={() => setModal(null)} />}
        </>
      )}
    </>
  );
}

function ReviewStatusBar({ doc }: { doc: ReviewDoc }) {
  return (
    <div style={{ flex: "0 0 56px", height: 56, padding: "0 32px", borderBottom: "1px solid var(--border)", background: "var(--bg-base)", display: "flex", alignItems: "center", gap: 16 }}>
      <StatusBadge status={doc.status} />
      <span style={{ color: "var(--border-strong)" }}>|</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 22, height: 22, borderRadius: 999, background: "var(--agent-tint)", border: "1px solid var(--agent-border)", color: "var(--agent-icon)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <IconRobot size={13} />
        </span>
        <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{doc.agent.name}</span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>· {doc.agent.instance} · submitted {doc.submittedAt}</span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
        <span style={{ color: "var(--text-muted)" }}>Diff:</span>
        <span style={{ color: "var(--approved-text)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>+{doc.diff.added}</span>
        <span style={{ color: "#993C1D", fontFamily: "var(--font-mono)", fontWeight: 500 }}>−{doc.diff.removed}</span>
        <span style={{ color: "var(--text-muted)" }}>· {doc.diff.isNew ? "new doc" : `${doc.diff.files} file`}</span>
      </div>
    </div>
  );
}

function DiffLine({ added, removed, children }: { added?: boolean; removed?: boolean; children: ReactNode }) {
  return (
    <div style={{ position: "relative", background: added ? "rgba(15,110,86,0.06)" : removed ? "rgba(153,60,29,0.06)" : "transparent", borderLeft: `3px solid ${added ? "var(--accent)" : removed ? "#993C1D" : "transparent"}`, padding: "4px 12px 4px 14px", margin: "0 -14px", borderRadius: 4 }}>
      {children}
    </div>
  );
}

function DiffBody({ doc, comments }: { doc: ReviewDoc; comments: ReviewComment[] }) {
  return (
    <div className="content" style={{ padding: "44px 40px 32px", background: "var(--bg-base)" }}>
      <article style={{ maxWidth: 720, margin: "0 auto", color: "var(--text-primary)", fontSize: 16, lineHeight: 1.7 }}>
        <DiffLine added>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 40, lineHeight: 1.1, letterSpacing: "-0.015em", margin: 0 }}>{doc.title}</h1>
        </DiffLine>
        <div style={{ height: 24 }} />
        {doc.body.map((s, i) => (
          <section key={i} style={{ marginTop: 28 }}>
            <DiffLine added>
              <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 24, letterSpacing: "-0.01em", margin: "0 0 10px" }}>{s.h}</h2>
            </DiffLine>
            <DiffLine added>
              {s.kind === "p" && <p style={{ margin: 0 }}>{s.body}</p>}
              {s.kind === "ul" && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 22 }}>
                  {s.body.map((it, k) => <li key={k} style={{ marginBottom: 4 }}>{it}</li>)}
                </ul>
              )}
            </DiffLine>
            {comments.filter((c) => c.anchor === s.h).map((c, k) => <CommentThread key={k} c={c} />)}
          </section>
        ))}
      </article>
    </div>
  );
}

function CommentThread({ c }: { c: ReviewComment }) {
  return (
    <div style={{ marginTop: 16, background: "var(--bg-card)", border: "1px solid var(--border)", borderLeft: "3px solid var(--review-border)", borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className={`avatar avatar-sm ${c.who.cls}`}>{c.who.initial}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{c.who.name}</span>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>· {c.when}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>on §{c.anchor}</span>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.55 }}>{c.body}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
        <button className="btn btn-ghost" style={{ height: 26, padding: "0 8px", fontSize: 12, gap: 4 }}>
          <IconReply size={12} /><span>Reply</span>
        </button>
        <button className="btn btn-ghost" style={{ height: 26, padding: "0 8px", fontSize: 12, color: "var(--text-muted)" }}>Resolve</button>
      </div>
    </div>
  );
}

function RailSection({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)" }}>{title}</span>
        {count != null && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{count}</span>}
      </div>
      {children}
    </div>
  );
}

function AgentContextRail({ doc, trail }: { doc: ReviewDoc; trail: AgentTrailEntry[] }) {
  return (
    <aside style={{ width: 320, flex: "0 0 320px", background: "var(--bg-card)", borderLeft: "1px solid var(--border)", overflow: "auto" }}>
      <RailSection title="Written by">
        <div style={{ padding: "12px 14px", background: "var(--agent-tint)", border: "1px solid var(--agent-border)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--agent-border)", color: "var(--agent-icon)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconRobot size={17} />
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{doc.agent.name}</span>
              <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{doc.agent.instance} · key ••••3f2a</span>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", paddingTop: 8, borderTop: "1px solid var(--agent-border)", fontSize: 11.5, color: "var(--text-secondary)" }}>
            <Stat label="Approval rate" value="94%" />
            <Stat label="Docs written" value="38" />
            <Stat label="Last write" value="1h ago" last />
          </div>
        </div>
      </RailSection>

      <RailSection title="Read before writing" count={trail.length}>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.45 }}>
          Agent queried <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>/api/agent/context</code> with
          <em style={{ fontStyle: "normal", color: "var(--text-secondary)", fontWeight: 500 }}> &quot;payout retry transient bank failure&quot;</em> before drafting.
        </div>
        {trail.map((d, i) => <TrailRow key={i} d={d} />)}
      </RailSection>

      <RailSection title="Linked Linear">
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)" }}>TAB-441</span>
          <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Payout retry — Jun incident</span>
          <span style={{ fontSize: 11, color: "#854F0B", fontWeight: 500 }}>In Review</span>
        </div>
      </RailSection>

      <RailSection title="Activity">
        <ActivityLine icon={<IconRobot size={12} />} body={<><strong style={{ fontWeight: 500 }}>{doc.agent.name}</strong> created draft</>} when="1h ago" />
        <ActivityLine icon={<IconChat size={12} />} body={<><strong style={{ fontWeight: 500 }}>Sara</strong> commented on §The fix</>} when="4m ago" />
        <ActivityLine icon={<IconBell size={12} />} body={<>Review request sent to Ali, Sara</>} when="1h ago" tint />
      </RailSection>
    </aside>
  );
}

function Stat({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ padding: "0 6px", borderRight: last ? "none" : "1px solid var(--agent-border)", display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </div>
  );
}

function TrailRow({ d }: { d: AgentTrailEntry }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, alignItems: "start", padding: "8px 8px", margin: "0 -8px", borderRadius: 6, cursor: "pointer" }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 5, background: "var(--bg-base)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.04em" }}>{d.type}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</span>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{d.space} · {d.note}</span>
      </div>
    </div>
  );
}

function ActivityLine({ icon, body, when, tint }: { icon: ReactNode; body: ReactNode; when: string; tint?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 10, alignItems: "center", padding: "6px 0" }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: tint ? "var(--review-bg)" : "var(--bg-base)", color: tint ? "var(--review-text)" : "var(--text-secondary)", border: `1px solid ${tint ? "var(--review-border)" : "var(--border)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{body}</span>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{when}</span>
    </div>
  );
}

function ReviewActionBar({ onAction }: { onAction: (m: Modal) => void }) {
  return (
    <div style={{ flex: "0 0 76px", height: 76, borderTop: "1px solid var(--border)", background: "var(--bg-card)", padding: "0 32px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, height: 44, padding: "0 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13.5 }}>
        <span style={{ color: "var(--text-muted)" }}><IconChat size={15} /></span>
        <span style={{ flex: 1, color: "var(--text-muted)" }}>Add a comment, @mention a teammate…</span>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>⌘↵</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="btn btn-ghost btn-ghost-danger" onClick={() => onAction("reject")}>
          <IconX size={13} /><span>Reject</span>
        </button>
        <button className="btn btn-secondary" onClick={() => onAction("request")}>
          <IconWarn size={13} /><span>Request changes</span>
        </button>
        <button className="btn btn-primary" onClick={() => onAction("approve")}>
          <IconCheck size={13} sw={2.2} /><span>Approve</span>
        </button>
      </div>
    </div>
  );
}

const MODAL_SHELL: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  boxShadow: "0 18px 48px -12px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.06)",
  zIndex: 51,
};

function RequestChangesModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ ...MODAL_SHELL, width: 560, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em" }}>Request changes</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>Tell Claude Code what to fix. It&apos;ll get the note, update the doc, and resubmit for review.</p>
      </div>
      <div style={{ padding: "10px 12px", background: "var(--bg-sidebar)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>1 unresolved comment will be included</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span className="avatar avatar-sm avatar-sara" style={{ flex: "0 0 22px" }}>S</span>
          <div style={{ lineHeight: 1.5, color: "var(--text-primary)", flex: 1 }}>
            &quot;Backoff curve looks right but can we double-check the jitter range? Bank API guidelines say 250–750ms not 0–500.&quot;
            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>— on §The fix</span>
          </div>
        </div>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Your note to the agent</span>
        <textarea defaultValue={"Two changes:\n1. Use jitter 250–750ms per bank API guidelines (not 0–500)\n2. Add a section on rollback — what we do if the new retry policy itself starts failing."} style={{ minHeight: 100, padding: "10px 12px", background: "var(--bg-base)", border: "1px solid var(--accent)", boxShadow: "0 0 0 3px rgba(15,110,86,0.12)", borderRadius: 6, fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.55, resize: "vertical", fontFamily: "inherit" }} />
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>Be specific. Agents follow instructions, not vibes.</span>
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8 }}>
        <Check checked />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Block until addressed</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>Doc stays in Review. Agent must resubmit before merge.</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Agent and Khalid will be notified.</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onClose}>
            <IconReply size={13} /><span>Send to agent</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmShell({ tone, title, icon, children, primaryLabel, primaryIcon, primaryTone, onClose }: {
  tone: "success" | "danger";
  title: string;
  icon: ReactNode;
  children: ReactNode;
  primaryLabel: string;
  primaryIcon: ReactNode;
  primaryTone?: "danger";
  onClose: () => void;
}) {
  const tones = {
    success: { bg: "var(--approved-bg)", border: "var(--approved-border)", color: "var(--approved-text)" },
    danger: { bg: "var(--stale-bg)", border: "var(--stale-border)", color: "var(--stale-text)" },
  };
  const t = tones[tone];
  return (
    <div style={{ ...MODAL_SHELL, width: 540, overflow: "hidden" }}>
      <div style={{ padding: "18px 26px", background: t.bg, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--bg-card)", color: t.color, border: `1px solid ${t.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
        <h2 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em", color: "var(--text-primary)" }}>{title}</h2>
      </div>
      <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>{children}</div>
      <div style={{ padding: "14px 26px", borderTop: "1px solid var(--border)", background: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>This decision is recorded in the doc&apos;s version history.</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={primaryTone === "danger" ? { background: "#993C1D", borderColor: "#993C1D", color: "#fff" } : undefined} onClick={onClose}>
            {primaryIcon}<span>{primaryLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", width: 88, flex: "0 0 88px" }}>{label}</span>
      <span style={{ fontSize: 13.5, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function ApproveModal({ onClose }: { onClose: () => void }) {
  return (
    <ConfirmShell tone="success" title="Approve this doc?" icon={<IconCheck size={17} sw={2.2} />} primaryLabel="Approve and publish" primaryIcon={<IconCheck size={13} sw={2.2} />} onClose={onClose}>
      <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        Approving promotes <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>v4</strong> to ground truth. From now on, agents will treat this doc as authoritative when answering questions in <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Engineering</strong>.
      </p>
      <div style={{ background: "var(--bg-sidebar)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <InfoLine label="Doc" value="Fix: Payout retry on transient bank failures" />
        <InfoLine label="Author" value={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: "var(--agent-tint)", border: "1px solid var(--agent-border)", color: "var(--agent-icon)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconRobot size={10} /></span>
          Claude Code · Ali&apos;s laptop
        </span>} />
        <InfoLine label="Version" value={<span style={{ fontFamily: "var(--font-mono)" }}>v3 → v4 · +8/−2 lines</span>} />
        <InfoLine label="Reviewers" value="Ali (you), Sara" />
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Note (optional)</span>
        <textarea defaultValue="Good catch on the jitter window. Approved — let's land this and add the same retry policy to the refund pipeline as a follow-up." style={{ minHeight: 72, padding: "10px 12px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.55, resize: "vertical", fontFamily: "inherit" }} />
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Posted to the doc&apos;s activity feed and the agent&apos;s context.</span>
      </label>
      <div style={{ padding: "12px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 18, height: 18, borderRadius: 4, background: "var(--accent)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconCheck size={11} sw={2.4} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Mirror to GitHub on approve</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
            Commits <code style={{ fontFamily: "var(--font-mono)" }}>engineering/fix-payout-retry.md</code> to <code style={{ fontFamily: "var(--font-mono)" }}>tabadulat/aqli-mirror</code>.
          </div>
        </div>
      </div>
    </ConfirmShell>
  );
}

function RejectModal({ onClose }: { onClose: () => void }) {
  return (
    <ConfirmShell tone="danger" title="Reject this doc?" icon={<IconX size={16} />} primaryLabel="Reject and archive" primaryIcon={<IconX size={13} />} primaryTone="danger" onClose={onClose}>
      <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        Rejecting closes this doc permanently. The agent won&apos;t auto-resubmit, and agents will not use any content from it when answering questions. <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Use Request changes</strong> if you want a revision instead.
      </p>
      <div style={{ background: "var(--stale-bg)", border: "1px solid var(--stale-border)", borderRadius: 8, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ color: "var(--stale-text)", display: "flex", marginTop: 2 }}><IconWarn size={15} /></span>
        <div style={{ fontSize: 12.5, color: "var(--stale-text)", lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 600 }}>This is destructive.</strong> Rejected docs stay in the archive for audit but are excluded from agent context and search. To revisit later, an admin must restore from the archive.
        </div>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Reason <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(required)</span></span>
        <textarea defaultValue="Wrong scope — this duplicates work in the existing Bank API Runbook §3.2 and the fix has already shipped. Closing to avoid two sources of truth." style={{ padding: "10px 12px", background: "var(--bg-base)", border: "1px solid #993C1D", boxShadow: "0 0 0 3px rgba(153,60,29,0.12)", borderRadius: 6, fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.55, minHeight: 72, resize: "vertical", fontFamily: "inherit" }} />
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Shown to the agent and stored in the doc&apos;s history.</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>
        <span style={{ width: 18, height: 18, borderRadius: 4, background: "transparent", border: "1.5px solid var(--border-strong)" }} />
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Also disable this agent&apos;s write scope</span>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginTop: 2 }}>If you&apos;re rejecting because the agent shouldn&apos;t have written here at all.</span>
        </span>
      </label>
    </ConfirmShell>
  );
}

function Check({ checked }: { checked?: boolean }) {
  return (
    <span style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`, background: checked ? "var(--accent)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
      {checked && <IconCheck size={11} sw={2.4} />}
    </span>
  );
}

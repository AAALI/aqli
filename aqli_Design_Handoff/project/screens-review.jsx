// Aqli — Review detail + Notifications (Batch 3 · closes J·07, opens J·15)
// The human-agent review loop in full: see what the agent wrote, why,
// what it read, then approve / request changes / reject.

const { Sidebar, TopBar, StatusBadge, AgentChip, AqliMark,
  IconHome, IconSearch, IconBell, IconChevDown, IconDots, IconRobot,
  IconCheck, IconArrowUpRight, IconSparkle, IconFile, IconBook,
  IconLink, IconClose, IconPlus } = window;

const Ic4 = ({ d, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IconX = (p) => <Ic4 {...p} d={<><path d="M6 6l12 12M18 6 6 18" /></>} sw={1.8} />;
const IconWarn = (p) => <Ic4 {...p} d={<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v5M12 17.5v.2" /></>} />;
const IconReply = (p) => <Ic4 {...p} d={<><path d="m9 9-5 5 5 5" /><path d="M4 14h11a5 5 0 0 0 0-10h-2" /></>} />;
const IconChat = (p) => <Ic4 {...p} d={<path d="M21 12a8 8 0 0 1-8 8H6l-3 2v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />} />;
const IconAt = (p) => <Ic4 {...p} d={<><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" /></>} />;
const IconArchive = (p) => <Ic4 {...p} d={<><path d="M3 7h18v4H3z" /><path d="M5 11v10h14V11" /><path d="M10 14h4" /></>} />;
const IconFlag = (p) => <Ic4 {...p} d={<><path d="M5 21V4l13 1.5L14 11l4 5.5L5 18" /></>} />;
const IconClock2 = (p) => <Ic4 {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />;

// ─────────────────────────────────────────────────────────────────────
// SAMPLE DATA
// ─────────────────────────────────────────────────────────────────────

const REVIEW_DOC = {
  title: "Fix: Payout retry on transient bank failures",
  type: "FIX",
  status: "Review",
  agent: { name: "Claude Code", instance: "Ali's laptop" },
  submittedAt: "1 hour ago",
  version: 1,
  diff: { added: 124, removed: 0, files: 1, isNew: true },
  body: [
    { h: "What broke", kind: "p", body: "Between 02:14 and 02:31 GST on Jun 4, eleven payouts to NBD, FAB, and Emirates NBD failed with transient bank-side 5xx responses. Our retry policy only fired on HTTP 408 timeouts, so the eleven payouts dropped to FAILED and surfaced to hosts as bounced." },
    { h: "Root cause", kind: "p", body: "The retry decorator in `payouts/retry.py` matched on a hardcoded set of error codes that excluded 502, 503, and 504 — the codes the three banks actually return during their nightly maintenance window." },
    { h: "The fix", kind: "ul", body: [
      "Retry on any 5xx that isn't 501, with exponential backoff (3s → 12s → 48s, capped at 5 attempts)",
      "Add a structured log entry per retry, tagged with bank, attempt number, and error code",
      "Surface a `payout.retry.exhausted` metric so we alert before the host sees a failure",
    ]},
    { h: "Verification", kind: "p", body: "Backfilled the eleven affected payouts manually through the admin tool, all settled by Jun 5 09:00 GST. Synthetic test runs against the bank sandbox confirm the new retry policy fires correctly on 502/503/504." },
    { h: "Follow-ups", kind: "ul", body: [
      "Add the same retry policy to the refund pipeline (separate PR)",
      "Document the bank maintenance windows in the Payout Schedule PRD",
    ]},
  ],
};

const AGENT_TRAIL = [
  { title: "Host Payout Schedule", type: "PRD", space: "Product", note: "Read full doc · v4" },
  { title: "Bank API Runbook", type: "RUN", space: "Engineering", note: "Read §3 Retry policy" },
  { title: "T&S Hold Rule 4.2 — Payout Holds", type: "POL", space: "Trust & Safety", note: "Read §c" },
  { title: "Fix: Identity Verification Status Sync", type: "FIX", space: "Engineering", note: "Read as prior-art" },
];

const COMMENTS = [
  {
    who: { name: "Sara", initial: "S", cls: "avatar-sara" },
    when: "4 minutes ago",
    body: "Backoff curve looks right but can we double-check the jitter range? Bank API guidelines say 250–750ms not 0–500.",
    anchor: "The fix",
  },
];

// ─────────────────────────────────────────────────────────────────────
// PARTS
// ─────────────────────────────────────────────────────────────────────

const ReviewStatusBar = ({ doc }) => (
  <div style={{
    flex: "0 0 56px", height: 56,
    padding: "0 32px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-base)",
    display: "flex", alignItems: "center", gap: 16,
  }}>
    <StatusBadge status={doc.status} />
    <span style={{ color: "var(--border-strong)" }}>|</span>

    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 999,
        background: "var(--agent-tint)",
        border: "1px solid var(--agent-border)",
        color: "var(--agent-icon)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        <IconRobot size={13} />
      </span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
        {doc.agent.name}
      </span>
      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        · {doc.agent.instance} · submitted {doc.submittedAt}
      </span>
    </div>

    <div style={{ flex: 1 }} />

    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
      <span style={{ color: "var(--text-muted)" }}>Diff:</span>
      <span style={{ color: "var(--approved-text)", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        +{doc.diff.added}
      </span>
      <span style={{ color: "#993C1D", fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        −{doc.diff.removed}
      </span>
      <span style={{ color: "var(--text-muted)" }}>· {doc.diff.isNew ? "new doc" : "1 file"}</span>
    </div>
  </div>
);

const DiffBody = ({ doc }) => (
  <div style={{
    flex: 1, overflow: "hidden",
    padding: "44px 40px 32px",
    background: "var(--bg-base)",
  }}>
    <article style={{
      maxWidth: 720, margin: "0 auto",
      color: "var(--text-primary)",
      fontSize: 16, lineHeight: 1.7,
    }}>
      {/* Title */}
      <DiffLine added>
        <h1 style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 400, fontSize: 40,
          lineHeight: 1.1, letterSpacing: "-0.015em",
          margin: 0,
        }}>
          {doc.title}
        </h1>
      </DiffLine>

      <div style={{ height: 24 }} />

      {doc.body.map((s, i) => (
        <section key={i} style={{ marginTop: 28 }}>
          <DiffLine added>
            <h2 style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 400, fontSize: 24,
              letterSpacing: "-0.01em",
              margin: "0 0 10px",
            }}>
              {s.h}
            </h2>
          </DiffLine>
          <DiffLine added>
            {s.kind === "p" && <p style={{ margin: 0 }}>{s.body}</p>}
            {s.kind === "ul" && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 22 }}>
                {s.body.map((it, k) => <li key={k} style={{ marginBottom: 4 }}>{it}</li>)}
              </ul>
            )}
          </DiffLine>

          {/* Inline comment threads */}
          {COMMENTS.filter((c) => c.anchor === s.h).map((c, k) => (
            <CommentThread key={k} c={c} />
          ))}
        </section>
      ))}
    </article>
  </div>
);

const DiffLine = ({ added, removed, children }) => (
  <div style={{
    position: "relative",
    background: added
      ? "rgba(15,110,86,0.06)"
      : removed ? "rgba(153,60,29,0.06)" : "transparent",
    borderLeft: `3px solid ${added ? "var(--accent)" : removed ? "#993C1D" : "transparent"}`,
    padding: "4px 12px 4px 14px",
    margin: "0 -14px",
    borderRadius: 4,
  }}>
    {children}
  </div>
);

const CommentThread = ({ c }) => (
  <div style={{
    marginTop: 16,
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderLeft: "3px solid var(--review-border)",
    borderRadius: 8,
    padding: "14px 16px",
    display: "flex", flexDirection: "column", gap: 10,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className={`avatar avatar-sm ${c.who.cls}`}>{c.who.initial}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
        {c.who.name}
      </span>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>· {c.when}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        on §{c.anchor}
      </span>
    </div>
    <div style={{ fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.55 }}>
      {c.body}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
      <button className="btn btn-ghost" style={{ height: 26, padding: "0 8px", fontSize: 12, gap: 4 }}>
        <IconReply size={12} />
        <span>Reply</span>
      </button>
      <button className="btn btn-ghost" style={{ height: 26, padding: "0 8px", fontSize: 12, color: "var(--text-muted)" }}>
        Resolve
      </button>
    </div>
  </div>
);

const AgentContextRail = () => (
  <aside style={{
    width: 320, flex: "0 0 320px",
    background: "var(--bg-card)",
    borderLeft: "1px solid var(--border)",
    overflow: "auto",
  }}>
    {/* Written by */}
    <RailSection title="Written by">
      <div style={{
        padding: "12px 14px",
        background: "var(--agent-tint)",
        border: "1px solid var(--agent-border)",
        borderRadius: 8,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8,
            background: "var(--bg-card)",
            border: "1px solid var(--agent-border)",
            color: "var(--agent-icon)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconRobot size={17} />
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>
              Claude Code
            </span>
            <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
              Ali's laptop · key ••••3f2a
            </span>
          </div>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 0,
          paddingTop: 8,
          borderTop: "1px solid var(--agent-border)",
          fontSize: 11.5, color: "var(--text-secondary)",
        }}>
          <Stat2 label="Approval rate" value="94%" />
          <Stat2 label="Docs written" value="38" />
          <Stat2 label="Last write" value="1h ago" last />
        </div>
      </div>
    </RailSection>

    {/* Agent's research trail */}
    <RailSection title="Read before writing" count={4}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10, lineHeight: 1.45 }}>
        Agent queried <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>/api/agent/context</code> with
        <em style={{ fontStyle: "normal", color: "var(--text-secondary)", fontWeight: 500 }}> "payout retry transient bank failure"</em> before drafting.
      </div>
      {AGENT_TRAIL.map((d, i) => <TrailRow key={i} d={d} />)}
    </RailSection>

    {/* Linked */}
    <RailSection title="Linked Linear">
      <LinkLine code="TAB-441" title="Payout retry — Jun incident" state="In Review" stateColor="#854F0B" />
    </RailSection>

    {/* Activity */}
    <RailSection title="Activity">
      <ActivityLine icon={<IconRobot />} body={<><strong style={{ fontWeight: 500 }}>Claude Code</strong> created draft</>} when="1h ago" />
      <ActivityLine icon={<IconChat />} body={<><strong style={{ fontWeight: 500 }}>Sara</strong> commented on §The fix</>} when="4m ago" />
      <ActivityLine icon={<IconBell />} body={<>Review request sent to Ali, Sara</>} when="1h ago" tint />
    </RailSection>
  </aside>
);

const RailSection = ({ title, count, children }) => (
  <div style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 10,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 600,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--text-muted)",
      }}>
        {title}
      </span>
      {count != null && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{count}</span>
      )}
    </div>
    {children}
  </div>
);

const Stat2 = ({ label, value, last }) => (
  <div style={{
    padding: "0 6px",
    borderRight: last ? "none" : "1px solid var(--agent-border)",
    display: "flex", flexDirection: "column", gap: 1,
    minWidth: 0,
  }}>
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: 13, fontWeight: 600,
      color: "var(--text-primary)",
    }}>
      {value}
    </span>
    <span style={{
      fontSize: 10, color: "var(--text-muted)",
      letterSpacing: "0.04em",
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    }}>
      {label}
    </span>
  </div>
);

const TrailRow = ({ d }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "28px 1fr",
    gap: 10, alignItems: "start",
    padding: "8px 8px", margin: "0 -8px",
    borderRadius: 6, cursor: "pointer",
  }}>
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 26, height: 26, borderRadius: 5,
      background: "var(--bg-base)",
      border: "1px solid var(--border)",
      fontFamily: "var(--font-mono)",
      fontSize: 9.5, fontWeight: 600,
      color: "var(--text-secondary)",
      letterSpacing: "0.04em",
    }}>
      {d.type}
    </span>
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{
        fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
        letterSpacing: "-0.005em",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {d.title}
      </span>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        {d.space} · {d.note}
      </span>
    </div>
  </div>
);

const LinkLine = ({ code, title, state, stateColor }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0", cursor: "pointer" }}>
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)" }}>{code}</span>
    <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
    <span style={{ fontSize: 11, color: stateColor, fontWeight: 500 }}>{state}</span>
  </div>
);

const ActivityLine = ({ icon, body, when, tint }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "22px 1fr auto",
    gap: 10, alignItems: "center", padding: "6px 0",
  }}>
    <span style={{
      width: 22, height: 22, borderRadius: 6,
      background: tint ? "var(--review-bg)" : "var(--bg-base)",
      color: tint ? "var(--review-text)" : "var(--text-secondary)",
      border: `1px solid ${tint ? "var(--review-border)" : "var(--border)"}`,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      {React.cloneElement(icon, { size: 12 })}
    </span>
    <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{body}</span>
    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{when}</span>
  </div>
);

// ── Sticky action bar ────────────────────────────────────────────────
const ReviewActionBar = ({ onAction }) => (
  <div style={{
    flex: "0 0 76px", height: 76,
    borderTop: "1px solid var(--border)",
    background: "var(--bg-card)",
    padding: "0 32px",
    display: "flex", alignItems: "center", gap: 16,
  }}>
    {/* Comment composer */}
    <div style={{
      flex: 1, display: "flex", alignItems: "center", gap: 10,
      height: 44, padding: "0 14px",
      background: "var(--bg-base)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      fontSize: 13.5,
    }}>
      <span style={{ color: "var(--text-muted)" }}><IconChat size={15} /></span>
      <span style={{ flex: 1, color: "var(--text-muted)" }}>
        Add a comment, @mention a teammate…
      </span>
      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        ⌘↵
      </span>
    </div>

    {/* Decision actions */}
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button className="btn btn-ghost btn-ghost-danger">
        <IconX size={13} />
        <span>Reject</span>
      </button>
      <button className="btn btn-secondary">
        <IconWarn size={13} />
        <span>Request changes</span>
      </button>
      <button className="btn btn-primary">
        <IconCheck size={13} sw={2.2} />
        <span>Approve</span>
      </button>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN A — Notifications panel
// ─────────────────────────────────────────────────────────────────────

const NOTIFS = [
  {
    kind: "review",
    unread: true,
    icon: <IconRobot />, tint: "agent",
    actor: "Claude Code",
    body: "submitted a Fix Note for review",
    target: "Fix: Payout retry on transient bank failures",
    space: "Engineering",
    when: "1 hour ago",
    primary: true,
  },
  {
    kind: "approval",
    unread: true,
    icon: <IconCheck />, tint: "ok",
    actor: "Sara",
    body: "approved your PRD",
    target: "AED Withdrawal Flow",
    space: "Product",
    when: "3 hours ago",
  },
  {
    kind: "mention",
    unread: true,
    icon: <IconAt />, tint: "review",
    actor: "Khalid",
    body: "mentioned you in",
    target: "WebSocket Connection Pooling",
    space: "Engineering",
    when: "5 hours ago",
  },
  {
    kind: "stale",
    unread: false,
    icon: <IconClock2 />, tint: "stale",
    actor: "Aqli",
    body: "flagged stale",
    target: "Search Ranking Service Runbook",
    space: "Engineering",
    when: "Yesterday",
  },
  {
    kind: "review",
    unread: false,
    icon: <IconRobot />, tint: "agent",
    actor: "Cursor",
    body: "submitted an ADR for review",
    target: "Sticky-host routing for reservations",
    space: "Engineering",
    when: "Yesterday",
  },
];

const NotificationsPanel = () => (
  <div className="aqli-screen" data-screen-label="11 · Notifications Panel" style={{ position: "relative" }}>
    <Sidebar activeNav="home" />
    <div className="main">
      <TopBar crumbs={["Home"]} primary={null} showShare={false} notify={true} />
      <div className="content" style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: 0.35,
      }}>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Home</div>
      </div>
    </div>

    {/* Popover anchored to top-right (under bell) */}
    <div style={{
      position: "absolute",
      top: 56 + 8, right: 24 + 28,
      width: 400,
      maxHeight: 560,
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      boxShadow: "0 18px 48px -12px rgba(20,20,18,0.22), 0 2px 6px rgba(20,20,18,0.06)",
      zIndex: 51,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px 0",
        display: "flex", flexDirection: "column", gap: 12,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{
            margin: 0, fontFamily: "var(--font-serif)",
            fontWeight: 400, fontSize: 18,
            letterSpacing: "-0.01em",
          }}>
            Notifications
          </h3>
          <button style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 500,
          }}>
            Mark all read
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: -1 }}>
          {[
            { l: "All", n: 5, active: true },
            { l: "Reviews", n: 2 },
            { l: "Mentions", n: 1 },
            { l: "Activity" },
          ].map((t) => (
            <button key={t.l} style={{
              background: "transparent", border: "none",
              padding: "8px 10px", cursor: "pointer",
              fontSize: 12.5,
              color: t.active ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: t.active ? 500 : 400,
              borderBottom: `2px solid ${t.active ? "var(--accent)" : "transparent"}`,
              marginBottom: -1,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              {t.l}
              {t.n != null && (
                <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {t.n}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ overflow: "auto", flex: 1 }}>
        <div style={{
          padding: "8px 16px 6px",
          fontSize: 10.5, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--text-muted)",
        }}>
          Today
        </div>
        {NOTIFS.slice(0, 3).map((n, i) => <NotifRow key={i} n={n} />)}
        <div style={{
          padding: "10px 16px 6px",
          fontSize: 10.5, fontWeight: 600,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--text-muted)",
        }}>
          Earlier
        </div>
        {NOTIFS.slice(3).map((n, i) => <NotifRow key={i + 3} n={n} />)}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 16px",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 12,
      }}>
        <a style={{ color: "var(--text-secondary)", fontWeight: 500, cursor: "pointer" }}>
          Notification settings
        </a>
        <a style={{ color: "var(--accent)", fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
          See all
          <IconArrowUpRight size={11} sw={1.8} />
        </a>
      </div>
    </div>
  </div>
);

const NotifRow = ({ n }) => {
  const tints = {
    agent: { bg: "var(--agent-tint)", color: "var(--agent-icon)", border: "var(--agent-border)" },
    ok: { bg: "var(--approved-bg)", color: "var(--approved-text)", border: "var(--approved-border)" },
    review: { bg: "var(--review-bg)", color: "var(--review-text)", border: "var(--review-border)" },
    stale: { bg: "var(--stale-bg)", color: "var(--stale-text)", border: "var(--stale-border)" },
  }[n.tint];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "32px 1fr 8px",
      gap: 12, alignItems: "start",
      padding: "12px 16px",
      background: n.primary ? "var(--accent-light)" : "transparent",
      borderBottom: "1px solid var(--border)",
      cursor: "pointer",
    }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8,
        background: tints.bg, color: tints.color,
        border: `1px solid ${tints.border}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginTop: 2,
      }}>
        {React.cloneElement(n.icon, { size: 14 })}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.45 }}>
          <strong style={{ fontWeight: 500 }}>{n.actor}</strong>{" "}
          <span style={{ color: "var(--text-secondary)" }}>{n.body}</span>
        </div>
        <div style={{
          fontSize: 13, color: "var(--text-primary)", fontWeight: 500,
          letterSpacing: "-0.005em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {n.target}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", gap: 6 }}>
          <span>{n.space}</span>
          <span>·</span>
          <span>{n.when}</span>
        </div>
      </div>
      {n.unread && (
        <span style={{
          width: 7, height: 7, borderRadius: 999,
          background: "var(--accent)",
          marginTop: 6,
        }} />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// SCREEN B — Review detail (main view)
// ─────────────────────────────────────────────────────────────────────

const ReviewDetail = () => (
  <div className="aqli-screen" style={{ height: 1100 }} data-screen-label="12 · Review Detail">
    <Sidebar activeNav="review" />
    <div className="main">
      <TopBar crumbs={["Review", "Fix: Payout retry…"]} primary={null} showShare={false} />
      <ReviewStatusBar doc={REVIEW_DOC} />
      <div className="main-body">
        <DiffBody doc={REVIEW_DOC} />
        <AgentContextRail />
      </div>
      <ReviewActionBar />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN C — Review detail + Request Changes modal
// ─────────────────────────────────────────────────────────────────────

const ReviewDetail_RequestChanges = () => (
  <div className="aqli-screen" style={{ height: 1100, position: "relative" }}
    data-screen-label="13 · Review · Request Changes">
    <Sidebar activeNav="review" />
    <div className="main">
      <TopBar crumbs={["Review", "Fix: Payout retry…"]} primary={null} showShare={false} />
      <ReviewStatusBar doc={REVIEW_DOC} />
      <div className="main-body" style={{ opacity: 0.5 }}>
        <DiffBody doc={REVIEW_DOC} />
        <AgentContextRail />
      </div>
      <ReviewActionBar />
    </div>

    <ScrimB />
    <RCModal />
  </div>
);

const ScrimB = () => (
  <div style={{
    position: "absolute", inset: 0,
    background: "rgba(20, 20, 18, 0.32)",
    zIndex: 50,
  }} />
);

const RCModal = () => (
  <div style={{
    position: "absolute", top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    width: 560,
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 18px 48px -12px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.06)",
    padding: "24px 26px",
    zIndex: 51,
    display: "flex", flexDirection: "column", gap: 18,
  }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h2 style={{
        margin: 0, fontFamily: "var(--font-serif)",
        fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em",
      }}>
        Request changes
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Tell Claude Code what to fix. It'll get the note, update the doc, and resubmit for review.
      </p>
    </div>

    {/* Recap of Sara's existing comment so the reviewer can carry it forward */}
    <div style={{
      padding: "10px 12px",
      background: "var(--bg-sidebar)",
      borderRadius: 8,
      border: "1px solid var(--border)",
      fontSize: 12, color: "var(--text-secondary)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        1 unresolved comment will be included
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span className="avatar avatar-sm avatar-sara" style={{ flex: "0 0 22px" }}>S</span>
        <div style={{ lineHeight: 1.5, color: "var(--text-primary)", flex: 1 }}>
          "Backoff curve looks right but can we double-check the jitter range? Bank API guidelines say 250–750ms not 0–500."
          <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>— on §The fix</span>
        </div>
      </div>
    </div>

    <FormFieldB label="Your note to the agent" hint="Be specific. Agents follow instructions, not vibes.">
      <TextareaB value="Two changes:&#10;1. Use jitter 250–750ms per bank API guidelines (not 0–500)&#10;2. Add a section on rollback — what we do if the new retry policy itself starts failing." />
    </FormFieldB>

    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 14px",
      background: "var(--bg-base)",
      border: "1px solid var(--border)",
      borderRadius: 8,
    }}>
      <Checkbox checked />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          Block until addressed
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
          Doc stays in Review. Agent must resubmit before merge.
        </div>
      </div>
    </div>

    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      gap: 8, paddingTop: 16,
      borderTop: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Agent and Khalid will be notified.
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost">Cancel</button>
        <button className="btn btn-primary">
          <IconReply size={13} />
          <span>Send to agent</span>
        </button>
      </div>
    </div>
  </div>
);

const FormFieldB = ({ label, hint, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
    {children}
    {hint && <span style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>{hint}</span>}
  </label>
);

const TextareaB = ({ value }) => (
  <div style={{
    minHeight: 100,
    padding: "10px 12px",
    background: "var(--bg-base)",
    border: "1px solid var(--accent)",
    boxShadow: "0 0 0 3px rgba(15,110,86,0.12)",
    borderRadius: 6,
    fontSize: 13.5,
    color: "var(--text-primary)",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  }}>
    {value}
  </div>
);

const Checkbox = ({ checked }) => (
  <span style={{
    width: 18, height: 18, borderRadius: 4,
    border: `1.5px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,
    background: checked ? "var(--accent)" : "transparent",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    color: "#fff",
  }}>
    {checked && <IconCheck size={11} sw={2.4} />}
  </span>
);

Object.assign(window, {
  NotificationsPanel,
  ReviewDetail,
  ReviewDetail_RequestChanges,
});

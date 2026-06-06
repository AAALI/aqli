// Aqli — Doc viewer + status change + new-doc type picker (Batch 2)
// Closes J·04 (browse & read), J·05 (create), J·06 (lifecycle).

const { Sidebar, TopBar, StatusBadge, AgentChip,
  IconChevDown, IconDots, IconLink, IconSparkle, IconRobot,
  IconCheck, IconArrowUpRight, IconFile, IconBook, IconFolder,
  IconPlus, IconClose } = window;

// Small icons unique to this batch
const Ic3 = ({ d, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IconEdit = (p) => (
  <Ic3 {...p} d={<><path d="M4 20h4l10-10-4-4L4 16v4Z" /><path d="m14 6 4 4" /></>} />
);
const IconClock = (p) => (
  <Ic3 {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
);
const IconBranch = (p) => (
  <Ic3 {...p} d={<><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="9" r="2" /><path d="M6 7v10" /><path d="M6 14a6 6 0 0 0 6-6h4" /></>} />
);

// ─────────────────────────────────────────────────────────────────────
// VIEWER PARTS
// ─────────────────────────────────────────────────────────────────────

// ── Viewer status bar (replaces the editor's MetaBar) ────────────────
const ViewerStatusBar = ({ status, owner, lastReviewed, version, primary, secondary }) => (
  <div style={{
    height: 48, flex: "0 0 48px",
    borderBottom: "1px solid var(--border)",
    padding: "0 32px",
    display: "flex", alignItems: "center", gap: 16,
    background: "var(--bg-base)",
    fontSize: 13,
  }}>
    <button style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 28, padding: "0 10px 0 8px", borderRadius: 6,
      background: "transparent", border: "1px solid transparent",
      cursor: "pointer",
    }}>
      <StatusBadge status={status} />
      <span style={{ color: "var(--text-muted)" }}><IconChevDown size={12} /></span>
    </button>

    <span style={{ color: "var(--border-strong)" }}>|</span>

    <MetaItem label="Owner">
      <span className={`avatar avatar-sm ${owner.cls}`}>{owner.initial}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{owner.name}</span>
    </MetaItem>

    <MetaItem label="Last reviewed">
      <span style={{ color: "var(--text-primary)" }}>{lastReviewed}</span>
    </MetaItem>

    <MetaItem label="Version">
      <span style={{
        fontFamily: "var(--font-mono)",
        color: "var(--text-primary)",
        fontSize: 12,
      }}>
        v{version}
      </span>
    </MetaItem>

    <div style={{ flex: 1 }} />

    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {secondary}
      {primary}
    </div>
  </div>
);

const MetaItem = ({ label, children }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)" }}>
    <span style={{
      color: "var(--text-muted)", fontSize: 11,
      textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500,
    }}>
      {label}
    </span>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {children}
    </span>
  </div>
);

// ── Read-only body (Tiptap-like markdown render) ─────────────────────
const ViewerBody = ({ doc }) => (
  <div style={{
    flex: 1,
    overflow: "hidden",
    padding: "56px 40px 48px",
    background: "var(--bg-base)",
  }}>
    <article style={{
      maxWidth: 720,
      margin: "0 auto",
      color: "var(--text-primary)",
      fontFamily: "var(--font-sans)",
      fontSize: 16,
      lineHeight: 1.7,
    }}>
      <h1 style={{
        fontFamily: "var(--font-serif)",
        fontWeight: 400,
        fontSize: 44,
        lineHeight: 1.1,
        letterSpacing: "-0.015em",
        margin: "0 0 12px",
      }}>
        {doc.title}
      </h1>

      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        color: "var(--text-muted)", fontSize: 13.5, marginBottom: 36,
      }}>
        <span>{doc.subtitle}</span>
      </div>

      {doc.sections.map((s, i) => (
        <section key={i} style={{ marginTop: 32 }}>
          <h2 style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: "-0.01em",
            margin: "0 0 10px",
            color: "var(--text-primary)",
          }}>
            {s.h}
          </h2>
          {s.kind === "p" && (
            <p style={{ margin: 0, color: "var(--text-primary)" }}>{s.body}</p>
          )}
          {s.kind === "ol" && (
            <ol style={{ margin: "10px 0 0", paddingLeft: 22, color: "var(--text-primary)" }}>
              {s.body.map((it, k) => <li key={k} style={{ marginBottom: 4 }}>{it}</li>)}
            </ol>
          )}
          {s.kind === "ul" && (
            <ul style={{ margin: "10px 0 0", paddingLeft: 22, color: "var(--text-primary)" }}>
              {s.body.map((it, k) => (
                <li key={k} style={{ marginBottom: 4 }}>
                  {typeof it === "string" ? it : (
                    <><strong style={{ fontWeight: 500 }}>{it.term}:</strong> {it.desc}</>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  </div>
);

// ── Viewer right rail ────────────────────────────────────────────────
const RailPanel = ({ title, action, children }) => (
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
      {action}
    </div>
    {children}
  </div>
);

const ViewerRightRail = ({ doc }) => (
  <aside style={{
    width: 300, flex: "0 0 300px",
    background: "var(--bg-card)",
    borderLeft: "1px solid var(--border)",
    overflow: "auto",
  }}>
    <RailPanel title="AI summary" action={
      <span style={{ color: "var(--accent)", display: "flex" }}>
        <IconSparkle size={13} />
      </span>
    }>
      <p style={{
        margin: 0, fontSize: 13, color: "var(--text-primary)",
        lineHeight: 1.55, letterSpacing: "-0.005em",
      }}>
        {doc.summary}
      </p>
      <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-muted)" }}>
        Generated from v{doc.version} · {doc.summaryAge}
      </div>
    </RailPanel>

    <RailPanel title="Linked Linear">
      <LinkRow code="TAB-234" title="AED withdrawal v2" state="In Progress" stateColor="#854F0B" />
      <LinkRow code="TAB-290" title="T&S review queue tooling" state="Backlog" stateColor="#6B6A64" />
    </RailPanel>

    <RailPanel title="Related docs" action={
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>3</span>
    }>
      <RelatedRow title="T&S Hold Rule 4.2 — Payout Holds" space="Trust & Safety" />
      <RelatedRow title="Host Identity Verification Flow" space="Product" />
      <RelatedRow title="Fix: Payout retry on transient bank failures" space="Engineering" />
    </RailPanel>

    <RailPanel title="Version history" action={
      <span style={{ fontSize: 11.5, color: "var(--accent)", cursor: "pointer" }}>See all</span>
    }>
      <HistoryRow ver={4} who={{ name: "Ali", cls: "avatar-ali", initial: "A" }} note="Status → Approved" when="Jun 1" current />
      <HistoryRow ver={3} who={{ name: "Sara", cls: "avatar-sara", initial: "S" }} note="Reviewed, requested changes" when="May 28" />
      <HistoryRow ver={2} who={{ name: "Ali", cls: "avatar-ali", initial: "A" }} note="Added §3 — error handling" when="May 27" />
    </RailPanel>
  </aside>
);

const LinkRow = ({ code, title, state, stateColor }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)" }}>{code}</span>
    <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
    <span style={{ fontSize: 11, color: stateColor, fontWeight: 500 }}>{state}</span>
  </div>
);

const RelatedRow = ({ title, space }) => (
  <div style={{ padding: "6px 8px", margin: "0 -8px", borderRadius: 6, cursor: "pointer", display: "flex", flexDirection: "column", gap: 2 }}>
    <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{title}</span>
    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{space}</span>
  </div>
);

const HistoryRow = ({ ver, who, note, when, current }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "26px 1fr auto",
    gap: 10, padding: "8px 0", alignItems: "start",
  }}>
    <span className={`avatar avatar-sm ${who.cls}`}>{who.initial}</span>
    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{note}</span>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        v{ver} · {who.name}{current && " · current"}
      </span>
    </div>
    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{when}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SAMPLE DOCS
// ─────────────────────────────────────────────────────────────────────

const DOC_AED = {
  title: "AED Withdrawal Flow",
  subtitle: "v4 · last reviewed Jun 1 by Ali",
  version: 4,
  summary: "Approved AED withdrawals settle in 1–5 business days. Any amount over AED 36,700 (≈ $10k) or flagged by anomaly detection is held for Trust & Safety review per Rule 4.2.",
  summaryAge: "indexed 2 minutes ago",
  sections: [
    { h: "Overview", kind: "p", body: "The AED withdrawal flow lets verified hosts move funds from their Tabadulat balance to a UAE bank account. Withdrawals are initiated by the host from the Earnings dashboard and settle in 1–5 business days subject to bank holidays and Trust & Safety review." },
    { h: "Goals", kind: "ul", body: [
      "Settle standard withdrawals within 5 business days of request",
      "Hold and review any withdrawal flagged by anomaly detection or above the AED 36,700 threshold",
      "Surface clear, timely status to the host throughout the lifecycle",
    ]},
    { h: "User Flow", kind: "ol", body: [
      "Verified host opens Earnings → Withdraw, enters amount, selects bank account",
      "Aqli validates the request against the host's tier limits and verification status",
      "If approved, the request is queued for the next settlement cycle (08:00 GST daily)",
      "Bank transfer is initiated; status flips to Processing → Settled or Returned",
      "Host receives an in-app and email notification on each state change",
    ]},
    { h: "Error states", kind: "ul", body: [
      { term: "Bank rejection", desc: "Retry once after 24h, then surface to the host with an action to update bank details" },
      { term: "T&S hold", desc: "Route to the review queue per Rule 4.2 §c, hold up to 5 business days" },
      { term: "Tier limit exceeded", desc: "Block at request time; show the host their current tier and how to upgrade" },
    ]},
  ],
};

const DOC_WS = {
  title: "WebSocket Connection Pooling",
  subtitle: "v3 · draft · started May 30 by Khalid",
  version: 3,
  summary: "Proposes a per-region pool of 64 long-lived WebSocket connections with a 30-second keepalive and a sticky-host hash so reconnects land back on the same backend.",
  summaryAge: "indexed 14 minutes ago",
  sections: [
    { h: "Context", kind: "p", body: "Reservation event delivery currently opens a fresh WebSocket per host session, which churns at peak and exhausts our load balancer's connection table during the morning rush. This ADR proposes a per-region pool of long-lived connections with sticky-host routing." },
    { h: "Decision", kind: "p", body: "Move to a fixed pool of 64 connections per region, keepalive 30s, with consistent-hash routing on host_id so reconnects land back on the same backend. Idle connections beyond 90s are gracefully drained." },
    { h: "Consequences", kind: "ul", body: [
      "Peak LB connections drop ~85% based on production traces",
      "First-load latency increases by ~80ms at cold start; warm reconnect drops by ~340ms",
      "Sticky routing complicates blue/green deploys — we'll need explicit drain step",
    ]},
    { h: "Open questions", kind: "ul", body: [
      "Pool sizing for the MENA region — 64 vs 96?",
      "Failure mode if a backend dies with 30+ sticky sessions on it",
    ]},
  ],
};

// ─────────────────────────────────────────────────────────────────────
// SCREEN A — Doc viewer · APPROVED (read mode)
// ─────────────────────────────────────────────────────────────────────

const DocViewer_Approved = () => (
  <div className="aqli-screen" style={{ height: 1000 }} data-screen-label="08 · Doc Viewer (Approved)">
    <Sidebar activeSpace="product" />
    <div className="main">
      <TopBar crumbs={["Product", "AED Withdrawal Flow"]}
        saved={null} primary={null} showShare={true} />
      <ViewerStatusBar
        status="Approved"
        owner={{ name: "Ali", initial: "A", cls: "avatar-ali" }}
        lastReviewed="Jun 1 by Ali"
        version={4}
        secondary={
          <button className="btn btn-ghost" style={{ gap: 6 }}>
            <IconBranch size={13} />
            <span>History</span>
          </button>
        }
        primary={
          <button className="btn btn-secondary" style={{ gap: 6 }}>
            <IconEdit size={13} />
            <span>Edit</span>
          </button>
        }
      />
      <div className="main-body">
        <ViewerBody doc={DOC_AED} />
        <ViewerRightRail doc={DOC_AED} />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN B — Doc viewer · DRAFT + Request Review modal
// ─────────────────────────────────────────────────────────────────────

const DocViewer_RequestReview = () => (
  <div className="aqli-screen" style={{ height: 1000, position: "relative" }} data-screen-label="09 · Request Review">
    <Sidebar activeSpace="engineering" />
    <div className="main">
      <TopBar crumbs={["Engineering", "WebSocket Connection Pooling"]}
        saved="Saved · just now"
        primary={null}
        showShare={true} />
      <ViewerStatusBar
        status="Draft"
        owner={{ name: "Khalid", initial: "K", cls: "avatar-khalid" }}
        lastReviewed="Not yet reviewed"
        version={3}
        primary={
          <>
            <button className="btn btn-secondary" style={{ gap: 6 }}>
              <IconEdit size={13} />
              <span>Edit</span>
            </button>
            <button className="btn btn-primary" style={{ gap: 6 }}>
              <IconCheck size={13} sw={2.2} />
              <span>Request review</span>
            </button>
          </>
        }
      />
      <div className="main-body" style={{ opacity: 0.6 }}>
        <ViewerBody doc={DOC_WS} />
        <ViewerRightRail doc={DOC_WS} />
      </div>
    </div>

    {/* Modal */}
    <ModalScrim2 />
    <Modal2 title="Request review" sub="Reviewers can approve, request changes, or reject. This snapshot becomes v4.">
      <FormField2 label="Reviewers" hint="Pick teammates who own this area. Anyone can chime in, only reviewers can decide.">
        <ReviewerPicker />
      </FormField2>

      <FormField2 label="Note" hint="Tell reviewers where to focus.">
        <Textarea value="Ready for review. Section 3 (sticky routing & blue/green) is the contentious bit — would love a second opinion there. Pool size for MENA is also open." />
      </FormField2>

      <FormField2 label="Notify via">
        <NotifyToggle />
      </FormField2>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, marginTop: 4, paddingTop: 16, borderTop: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Doc will move from <strong style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Draft</strong> to <strong style={{ color: "var(--review-text)", fontWeight: 500 }}>In Review</strong>.
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost">Cancel</button>
          <button className="btn btn-primary">Send for review</button>
        </div>
      </div>
    </Modal2>
  </div>
);

// ── Reviewer picker (multipick chips) ────────────────────────────────
const ReviewerPicker = () => (
  <div style={{
    display: "flex", flexWrap: "wrap", gap: 6,
    padding: "8px 10px",
    background: "var(--bg-base)",
    border: "1px solid var(--accent)",
    boxShadow: "0 0 0 3px rgba(15,110,86,0.12)",
    borderRadius: 6,
    minHeight: 38,
  }}>
    <ReviewerChip name="Ali" cls="avatar-ali" initial="A" />
    <ReviewerChip name="Sara" cls="avatar-sara" initial="S" />
    <span style={{
      fontSize: 13, color: "var(--text-muted)",
      display: "inline-flex", alignItems: "center", padding: "0 4px",
    }}>
      + Add reviewer
    </span>
  </div>
);

const ReviewerChip = ({ name, cls, initial }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "3px 8px 3px 4px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500,
  }}>
    <span className={`avatar avatar-sm ${cls}`} style={{ width: 18, height: 18, fontSize: 9 }}>
      {initial}
    </span>
    {name}
    <span style={{ color: "var(--text-muted)", cursor: "pointer", display: "flex" }}>
      <IconClose size={10} />
    </span>
  </span>
);

const Textarea = ({ value }) => (
  <div style={{
    minHeight: 78,
    padding: "10px 12px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 13.5,
    color: "var(--text-primary)",
    lineHeight: 1.55,
  }}>
    {value}
  </div>
);

const NotifyToggle = () => {
  const opts = [
    { label: "In-app + email", on: true },
    { label: "Slack #doc-review", on: true },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {opts.map((o, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 12px",
          background: o.on ? "var(--accent-light)" : "var(--bg-base)",
          border: `1px solid ${o.on ? "rgba(15,110,86,0.3)" : "var(--border)"}`,
          borderRadius: 8,
        }}>
          <span style={{
            width: 28, height: 16, borderRadius: 999,
            background: o.on ? "var(--accent)" : "var(--border-strong)",
            position: "relative", flex: "0 0 28px",
          }}>
            <span style={{
              position: "absolute", top: 2, left: o.on ? 14 : 2,
              width: 12, height: 12, borderRadius: 999,
              background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }} />
          </span>
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{o.label}</span>
        </div>
      ))}
    </div>
  );
};

const FormField2 = ({ label, hint, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{
      fontSize: 12, fontWeight: 500,
      color: "var(--text-primary)", letterSpacing: "-0.005em",
    }}>
      {label}
    </span>
    {children}
    {hint && (
      <span style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.45 }}>
        {hint}
      </span>
    )}
  </label>
);

const ModalScrim2 = () => (
  <div style={{
    position: "absolute", inset: 0,
    background: "rgba(20, 20, 18, 0.32)", zIndex: 50,
  }} />
);

const Modal2 = ({ title, sub, width = 520, children }) => (
  <div style={{
    position: "absolute", top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    width, maxHeight: "calc(100% - 64px)",
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
        margin: 0,
        fontFamily: "var(--font-serif)",
        fontWeight: 400, fontSize: 22,
        letterSpacing: "-0.01em",
        color: "var(--text-primary)",
      }}>
        {title}
      </h2>
      {sub && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {sub}
        </p>
      )}
    </div>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN C — New Doc · type & template picker
// ─────────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { id: "prd", code: "PRD", name: "Product requirement", desc: "Problem, goals, non-goals, user flow, requirements." },
  { id: "adr", code: "ADR", name: "Architecture decision", desc: "Context, decision, alternatives, consequences." },
  { id: "runbook", code: "RUN", name: "Runbook", desc: "Operational playbook — symptoms, checks, fix, escalate." },
  { id: "fix", code: "FIX", name: "Fix note", desc: "What broke, root cause, the change, follow-ups." },
  { id: "policy", code: "POL", name: "Compliance / policy", desc: "Scope, rules, exceptions, audit trail." },
  { id: "decision", code: "DEC", name: "Decision log", desc: "One-off decision with rationale and date." },
  { id: "general", code: "DOC", name: "General doc", desc: "Blank canvas — no scaffolding." },
];

const TEMPLATE_PRD = {
  intro: "A clean structure for product specs. Inherits the PRD format the team uses across Tabadulat.",
  sections: [
    "## Problem",
    "What's broken or under-served, in one paragraph.",
    "## Goals",
    "What this work must achieve. 3–5 bullets.",
    "## Non-goals",
    "Things we are deliberately not solving here.",
    "## User stories",
    "As a {role}, I want {action}, so that {outcome}.",
    "## Requirements — P0",
    "Must-haves.",
    "## Requirements — P1",
    "Nice-to-haves.",
    "## Open questions",
    "Decisions still pending, with owner.",
    "## Success metrics",
    "Leading and lagging metrics, with targets.",
  ],
};

const NewDoc_TypePicker = () => (
  <div className="aqli-screen" style={{ position: "relative" }} data-screen-label="10 · New Doc · Type Picker">
    <Sidebar activeSpace="product" />
    <div className="main">
      <TopBar crumbs={["Product"]} saved={null} primary="New Doc" showShare={false} />
      <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Product · 9 docs
        </div>
      </div>
    </div>

    <ModalScrim2 />

    {/* Picker modal — bigger than form modals */}
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: 880, height: 560,
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      boxShadow: "0 18px 48px -12px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.06)",
      zIndex: 51,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "20px 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 400, fontSize: 22,
            letterSpacing: "-0.01em",
          }}>
            New doc in Product
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Pick a type. The doc starts with a template you can edit or strip.
          </p>
        </div>
        <button style={{
          background: "transparent", border: "none",
          color: "var(--text-muted)", cursor: "pointer",
          padding: 4, display: "flex",
        }}>
          <IconClose size={18} />
        </button>
      </div>

      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "320px 1fr",
        minHeight: 0,
      }}>
        {/* Type list */}
        <div style={{
          padding: "12px 8px",
          borderRight: "1px solid var(--border)",
          background: "var(--bg-base)",
          overflow: "auto",
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          {DOC_TYPES.map((t) => (
            <TypeTile key={t.id} t={t} selected={t.id === "prd"} />
          ))}
        </div>

        {/* Preview pane */}
        <div style={{
          padding: "20px 24px",
          overflow: "auto",
          background: "var(--bg-card)",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 6,
              background: "var(--accent-light)",
              color: "var(--accent)",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5, fontWeight: 600,
              letterSpacing: "0.04em",
              border: "1px solid rgba(15,110,86,0.2)",
            }}>
              PRD
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em" }}>
                Product requirement
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                8 sections · ≈ 250 words of scaffolding
              </span>
            </div>
          </div>

          <p style={{
            margin: 0, fontSize: 13, color: "var(--text-secondary)",
            lineHeight: 1.55,
          }}>
            {TEMPLATE_PRD.intro}
          </p>

          {/* Template preview */}
          <div style={{
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "18px 22px",
            display: "flex", flexDirection: "column", gap: 8,
            flex: 1, overflow: "auto",
          }}>
            {TEMPLATE_PRD.sections.map((line, i) => {
              const isHeading = line.startsWith("##");
              return (
                <div key={i} style={{
                  fontFamily: isHeading ? "var(--font-serif)" : "var(--font-sans)",
                  fontSize: isHeading ? 16 : 13,
                  fontWeight: isHeading ? 400 : 400,
                  color: isHeading ? "var(--text-primary)" : "var(--text-muted)",
                  letterSpacing: isHeading ? "-0.01em" : 0,
                  marginTop: isHeading && i > 0 ? 8 : 0,
                }}>
                  {isHeading ? line.replace(/^##\s+/, "") : line}
                </div>
              );
            })}
          </div>

          {/* Doc title input + create */}
          <div style={{
            display: "flex", flexDirection: "column", gap: 6,
            paddingTop: 6,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.12em",
              color: "var(--text-muted)",
            }}>
              Title
            </span>
            <div style={{
              display: "flex", alignItems: "center",
              height: 40, padding: "0 14px",
              background: "var(--bg-base)",
              border: "1px solid var(--accent)",
              boxShadow: "0 0 0 3px rgba(15,110,86,0.12)",
              borderRadius: 8,
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
            }}>
              <span style={{ color: "var(--text-primary)" }}>Reservation Cancellation Policy v3</span>
              <span style={{
                width: 1.5, height: 18, background: "var(--accent)", marginLeft: 1,
                animation: "aqli-blink 1.05s steps(1) infinite",
              }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{
        padding: "14px 24px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-base)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          Template can be edited per workspace in <span style={{ color: "var(--text-secondary)" }}>Settings → Workspace</span>.
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost">Cancel</button>
          <button className="btn btn-primary">
            <IconPlus size={13} sw={2} />
            <span>Create doc</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);

const TypeTile = ({ t, selected }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "36px 1fr",
    gap: 10,
    padding: "10px 12px",
    background: selected ? "var(--bg-card)" : "transparent",
    border: `1px solid ${selected ? "var(--border-strong)" : "transparent"}`,
    borderRadius: 8, cursor: "pointer",
  }}>
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 36, height: 36, borderRadius: 6,
      background: selected ? "var(--accent-light)" : "var(--bg-card)",
      color: selected ? "var(--accent)" : "var(--text-secondary)",
      border: `1px solid ${selected ? "rgba(15,110,86,0.2)" : "var(--border)"}`,
      fontFamily: "var(--font-mono)",
      fontSize: 10.5, fontWeight: 600,
      letterSpacing: "0.04em",
    }}>
      {t.code}
    </span>
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{
        fontSize: 13.5, fontWeight: 500,
        color: selected ? "var(--accent)" : "var(--text-primary)",
        letterSpacing: "-0.005em",
      }}>
        {t.name}
      </span>
      <span style={{
        fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4,
        overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {t.desc}
      </span>
    </div>
  </div>
);

Object.assign(window, {
  DocViewer_Approved,
  DocViewer_RequestReview,
  NewDoc_TypePicker,
});

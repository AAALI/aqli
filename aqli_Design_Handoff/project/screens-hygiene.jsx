// Aqli — Stale dashboard + Agent activity log (Batch 6 · P1)
// Closes J·14 (stale hygiene) and the agent-activity surface from the
// settings hub. After this batch, every PRD journey has at least one screen.

const { Sidebar, TopBar, StatusBadge, TypeBadge, AgentChip,
  IconChevDown, IconDots, IconRobot, IconCheck, IconArrowUpRight,
  IconKey, IconBell, IconBook, IconClose, IconFile,
  IconPlus, IconSparkle } = window;

const Ic7 = ({ d, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IconClock3 = (p) => <Ic7 {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />;
const IconArchive2 = (p) => <Ic7 {...p} d={<><path d="M3 7h18v4H3z" /><path d="M5 11v10h14V11" /><path d="M10 14h4" /></>} />;
const IconUserPlus = (p) => <Ic7 {...p} d={<><circle cx="9" cy="9" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M19 6v6M16 9h6" /></>} />;
const IconFilter = (p) => <Ic7 {...p} d={<path d="M4 5h16l-6 8v6l-4-2v-4Z" />} />;

// ─────────────────────────────────────────────────────────────────────
// SCREEN A — Stale dashboard (J·14)
// ─────────────────────────────────────────────────────────────────────

const STALE_DOCS = [
  {
    title: "Search Ranking Service Runbook",
    type: "Runbook", space: "Engineering",
    owner: { name: "Sara", initial: "S", cls: "avatar-sara" },
    age: 142, last: "Jan 15, 2026",
    risk: "high", reason: "Referenced 38× by agents in the last 30 days",
  },
  {
    title: "Reservation Cancellation Policy v2",
    type: "Policy", space: "Trust & Safety",
    owner: { name: "Ali", initial: "A", cls: "avatar-ali" },
    age: 121, last: "Feb 5, 2026",
    risk: "high", reason: "Compliance doc — quarterly review required",
  },
  {
    title: "Internal Tools — Backfill Playbook",
    type: "Runbook", space: "Engineering",
    owner: { name: "Khalid", initial: "K", cls: "avatar-khalid" },
    age: 108, last: "Feb 18, 2026",
    risk: "med", reason: "Linked from 4 active fix notes",
  },
  {
    title: "Onboarding Email Sequence v1",
    type: "PRD", space: "Product",
    owner: { name: "Ali", initial: "A", cls: "avatar-ali" },
    age: 97, last: "Mar 1, 2026",
    risk: "med", reason: "Superseded by v2 draft (Khalid)",
  },
  {
    title: "Webhook Signature Verification",
    type: "ADR", space: "Engineering",
    owner: { name: "Sara", initial: "S", cls: "avatar-sara" },
    age: 95, last: "Mar 3, 2026",
    risk: "low", reason: "Not referenced in 30 days",
  },
  {
    title: "Bank Settlement Cutoff Windows",
    type: "Runbook", space: "Engineering",
    owner: { name: "Khalid", initial: "K", cls: "avatar-khalid" },
    age: 92, last: "Mar 6, 2026",
    risk: "low", reason: "Not referenced in 30 days",
  },
];

const StaleDashboard = () => (
  <div className="aqli-screen" style={{ height: 1100 }} data-screen-label="22 · Stale dashboard">
    <Sidebar activeNav="stale" />
    <div className="main">
      <TopBar crumbs={["Stale docs"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 40px", overflow: "auto" }}>
        {/* Header */}
        <header style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          gap: 24, paddingBottom: 24, marginBottom: 24,
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--text-muted)",
            }}>
              Hygiene
            </div>
            <h1 style={{
              margin: 0, fontFamily: "var(--font-serif)",
              fontWeight: 400, fontSize: 34,
              letterSpacing: "-0.015em", lineHeight: 1.1,
            }}>
              Stale docs
            </h1>
            <p style={{ margin: 0, maxWidth: 640, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              Docs not reviewed within your workspace's freshness window (90 days).
              Stale docs still serve agents, but a human should confirm they're current
              before they're treated as ground truth.
            </p>
          </div>
          <button className="btn btn-secondary">
            <IconClose size={13} />
            <span>Configure threshold</span>
          </button>
        </header>

        {/* Stat strip */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          marginBottom: 22,
          overflow: "hidden",
        }}>
          <SStat label="Stale docs" value="14" hint="of 38 total · 37%" />
          <SStat label="High risk" value="2" hint="compliance + agent-referenced" color="#993C1D" />
          <SStat label="Avg staleness" value="104 days" hint="median 97" />
          <SStat label="Oldest" value="142 days" hint="Search Ranking Runbook" last />
        </div>

        {/* Filter row + bulk actions */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <div className="fpills">
            <button className="fpill is-active">All · 14</button>
            <button className="fpill">
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#993C1D", marginRight: 6 }} />
              High risk · 2
            </button>
            <button className="fpill">
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--review-text)", marginRight: 6 }} />
              Medium · 4
            </button>
            <button className="fpill">
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--text-muted)", marginRight: 6 }} />
              Low · 8
            </button>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 12.5, color: "var(--text-secondary)",
          }}>
            <span style={{ color: "var(--text-muted)" }}>Sort:</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Oldest first</span>
            <IconChevDown size={13} />
          </div>
        </div>

        {/* Bulk select bar — 2 selected (the two high-risk) */}
        <div style={{
          display: "flex", alignItems: "center",
          gap: 14, padding: "10px 16px",
          background: "var(--accent-light)",
          border: "1px solid rgba(15,110,86,0.25)",
          borderRadius: 8,
          marginBottom: 12,
          fontSize: 13,
        }}>
          <span style={{
            width: 18, height: 18, borderRadius: 4,
            background: "var(--accent)", color: "#fff",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconCheck size={11} sw={2.4} />
          </span>
          <span style={{ color: "var(--accent)", fontWeight: 500 }}>
            2 selected
          </span>
          <span style={{ color: "var(--text-secondary)" }}>·</span>
          <span style={{ color: "var(--text-secondary)" }}>
            Search Ranking Runbook, Reservation Cancellation Policy v2
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary">
            <IconUserPlus size={13} />
            <span>Reassign owner</span>
          </button>
          <button className="btn btn-secondary">
            <IconBell size={13} />
            <span>Request re-review</span>
          </button>
          <button className="btn btn-ghost btn-ghost-danger">
            <IconArchive2 size={13} />
            <span>Archive</span>
          </button>
        </div>

        {/* List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STALE_DOCS.map((d, i) => <StaleRow key={i} d={d} selected={i < 2} />)}
        </div>

        {/* AI suggestion footer */}
        <div style={{
          marginTop: 22,
          padding: "16px 18px",
          background: "var(--bg-sidebar)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 6,
            background: "var(--accent-light)",
            color: "var(--accent)",
            border: "1px solid rgba(15,110,86,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconSparkle size={13} />
          </span>
          <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Aqli suggests:</strong> ask Claude Code to draft a refresh of the two high-risk docs. Each draft will land in Draft for your review.
          </div>
          <button className="btn btn-secondary">
            <IconRobot size={13} />
            <span>Ask agent to refresh</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);

const SStat = ({ label, value, hint, color, last }) => (
  <div style={{
    padding: "16px 20px",
    borderRight: last ? "none" : "1px solid var(--border)",
    display: "flex", flexDirection: "column", gap: 4,
  }}>
    <span style={{
      fontSize: 10.5, fontWeight: 600,
      letterSpacing: "0.12em", textTransform: "uppercase",
      color: "var(--text-muted)",
    }}>{label}</span>
    <span style={{
      fontFamily: "var(--font-serif)",
      fontSize: 24, fontWeight: 400,
      color: color || "var(--text-primary)", lineHeight: 1.1,
    }}>{value}</span>
    {hint && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{hint}</span>}
  </div>
);

const StaleRow = ({ d, selected }) => {
  const riskPalette = {
    high: { bg: "var(--stale-bg)", color: "var(--stale-text)", border: "var(--stale-border)", label: "High" },
    med: { bg: "var(--review-bg)", color: "var(--review-text)", border: "var(--review-border)", label: "Medium" },
    low: { bg: "var(--draft-bg)", color: "var(--draft-text)", border: "var(--draft-border)", label: "Low" },
  }[d.risk];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "22px 70px 1fr 100px 150px 110px 32px",
      gap: 14, alignItems: "center",
      padding: "14px 18px",
      background: "var(--bg-card)",
      border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 8,
      boxShadow: selected ? "0 0 0 2px rgba(15,110,86,0.08)" : "none",
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: 4,
        background: selected ? "var(--accent)" : "var(--bg-base)",
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border-strong)"}`,
        color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        {selected && <IconCheck size={11} sw={2.4} />}
      </span>

      <TypeBadge type={d.type} />

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{
          fontSize: 14, fontWeight: 500,
          color: "var(--text-primary)",
          letterSpacing: "-0.005em",
        }}>
          {d.title}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {d.space} · {d.reason}
        </span>
      </div>

      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        height: 22, padding: "0 8px", borderRadius: 6,
        background: riskPalette.bg, color: riskPalette.color,
        border: `1px solid ${riskPalette.border}`,
        fontSize: 11.5, fontWeight: 500,
        width: "fit-content",
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: "currentColor" }} />
        {riskPalette.label}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
        <span className={`avatar avatar-sm ${d.owner.cls}`}>{d.owner.initial}</span>
        <span>{d.owner.name}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 12.5,
          color: d.risk === "high" ? "#993C1D" : "var(--text-secondary)",
          fontWeight: 500,
        }}>
          {d.age} days
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          since {d.last}
        </span>
      </div>

      <span style={{ color: "var(--text-muted)", justifySelf: "center", cursor: "pointer" }}>
        <IconDots size={16} />
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// SCREEN B — Settings · Agent activity log
// ─────────────────────────────────────────────────────────────────────

const AGENT_EVENTS = [
  {
    when: "2m",
    agent: "Claude Code",
    cls: "agent",
    action: "read",
    target: "AED Withdrawal Flow",
    space: "Product",
    detail: "queried 'withdrawal anomaly threshold' · 4 chunks returned",
  },
  {
    when: "8m",
    agent: "Cursor",
    cls: "agent",
    action: "read",
    target: "Reservation Engine Architecture",
    space: "Engineering",
    detail: "queried 'sticky routing' · 3 chunks returned",
  },
  {
    when: "1h",
    agent: "Claude Code",
    cls: "agent",
    action: "wrote",
    target: "Fix: Payout retry on transient bank failures",
    space: "Engineering",
    detail: "new Fix Note · 124 lines · sent for review",
    status: "Review",
  },
  {
    when: "3h",
    agent: "Claude Code",
    cls: "agent",
    action: "requested review",
    target: "Fix: Payout retry on transient bank failures",
    space: "Engineering",
    detail: "notified Ali, Sara",
  },
  {
    when: "5h",
    agent: "GPT-4o Batch Worker",
    cls: "agent",
    action: "read",
    target: "T&S Hold Rule 4.2",
    space: "Trust & Safety",
    detail: "queried 'payout hold thresholds' · 2 chunks returned",
  },
  {
    when: "Yesterday",
    agent: "Cursor",
    cls: "agent",
    action: "wrote",
    target: "Sticky-host routing for reservations",
    space: "Engineering",
    detail: "new ADR · 86 lines · sent for review",
    status: "Review",
  },
  {
    when: "Yesterday",
    agent: "Claude Code",
    cls: "agent",
    action: "wrote",
    target: "Fix: Identity Verification Status Sync",
    space: "Engineering",
    detail: "new Fix Note · 52 lines",
    status: "Approved",
  },
];

const Settings_AgentActivity = () => (
  <div className="aqli-screen" style={{ height: 1100 }} data-screen-label="23 · Agent activity log">
    <SettingsSB7 active="agents" />
    <div className="main">
      <TopBar crumbs={["Settings", "Agent activity"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
        <header style={{
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          gap: 24, paddingBottom: 22, marginBottom: 22,
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 style={{
              margin: 0, fontFamily: "var(--font-serif)",
              fontWeight: 400, fontSize: 34,
              letterSpacing: "-0.015em", lineHeight: 1.1,
            }}>
              Agent activity
            </h1>
            <p style={{ margin: 0, maxWidth: 640, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              Every read and write your agents made, with the context they queried. Use this to build trust before approving the next agent doc.
            </p>
          </div>
          <button className="btn btn-secondary">
            <span>Export · 7 days</span>
            <IconArrowUpRight size={12} sw={1.7} />
          </button>
        </header>

        {/* Per-agent summary cards */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12, marginBottom: 22,
        }}>
          <AgentSummaryCard
            name="Claude Code"
            instance="Ali's laptop"
            reads={142} writes={8}
            approval={94}
            top
          />
          <AgentSummaryCard
            name="Cursor"
            instance="Sara's workstation"
            reads={86} writes={3}
            approval={100}
          />
          <AgentSummaryCard
            name="GPT-4o Batch Worker"
            instance="Compliance only"
            reads={28} writes={0}
            approval={null}
          />
        </div>

        {/* Filter row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14,
        }}>
          <div className="fpills">
            <button className="fpill is-active">All · 248</button>
            <button className="fpill">Reads · 224</button>
            <button className="fpill">Writes · 14</button>
            <button className="fpill">Review actions · 10</button>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 6,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)", cursor: "pointer",
            }}>
              <IconFilter size={13} />
              Agent: <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>All</strong>
              <IconChevDown size={12} />
            </button>
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px", borderRadius: 6,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)", cursor: "pointer",
            }}>
              Last <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>7 days</strong>
              <IconChevDown size={12} />
            </button>
          </div>
        </div>

        {/* Event log */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "80px 200px 100px 1fr 120px",
            gap: 14, padding: "12px 20px",
            background: "var(--bg-sidebar)",
            borderBottom: "1px solid var(--border)",
            fontSize: 10.5, fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--text-muted)",
          }}>
            <span>When</span>
            <span>Agent</span>
            <span>Action</span>
            <span>Target + context</span>
            <span style={{ justifySelf: "end" }}>Outcome</span>
          </div>
          {AGENT_EVENTS.map((e, i) => <EventRow key={i} e={e} />)}
        </div>
      </div>
    </div>
  </div>
);

const AgentSummaryCard = ({ name, instance, reads, writes, approval, top }) => (
  <div style={{
    padding: "16px 18px",
    background: top ? "var(--accent-light)" : "var(--bg-card)",
    border: `1px solid ${top ? "rgba(15,110,86,0.25)" : "var(--border)"}`,
    borderRadius: 10,
    display: "flex", flexDirection: "column", gap: 12,
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
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>
          {name}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {instance}
        </span>
      </div>
      {top && (
        <span style={{
          marginLeft: "auto",
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.08em", textTransform: "uppercase",
          padding: "2px 6px", borderRadius: 3,
          background: "var(--accent)", color: "#fff",
        }}>
          Top
        </span>
      )}
    </div>
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      paddingTop: 8, borderTop: "1px solid var(--border)",
    }}>
      <MiniStat value={reads} label="Reads · 7d" />
      <MiniStat value={writes} label="Writes" />
      <MiniStat value={approval == null ? "—" : `${approval}%`} label="Approval rate" last />
    </div>
  </div>
);

const MiniStat = ({ value, label, last }) => (
  <div style={{
    paddingRight: last ? 0 : 8,
    borderRight: last ? "none" : "1px solid var(--border)",
    display: "flex", flexDirection: "column", gap: 2,
    minWidth: 0,
  }}>
    <span style={{
      fontFamily: "var(--font-mono)",
      fontSize: 15, fontWeight: 600,
      color: "var(--text-primary)",
    }}>
      {value}
    </span>
    <span style={{
      fontSize: 10.5, color: "var(--text-muted)",
      letterSpacing: "0.04em",
    }}>
      {label}
    </span>
  </div>
);

const EventRow = ({ e }) => {
  const actionPalette = {
    read: { bg: "var(--bg-sidebar)", color: "var(--text-secondary)", border: "var(--border)" },
    wrote: { bg: "var(--accent-light)", color: "var(--accent)", border: "rgba(15,110,86,0.25)" },
    "requested review": { bg: "var(--review-bg)", color: "var(--review-text)", border: "var(--review-border)" },
  }[e.action] || { bg: "var(--bg-sidebar)", color: "var(--text-secondary)", border: "var(--border)" };
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "80px 200px 100px 1fr 120px",
      gap: 14, alignItems: "center",
      padding: "12px 20px",
      borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        {e.when}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 5,
          background: "var(--agent-tint)",
          border: "1px solid var(--agent-border)",
          color: "var(--agent-icon)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <IconRobot size={12} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{e.agent}</span>
      </div>
      <span style={{
        display: "inline-flex", alignItems: "center",
        height: 22, padding: "0 8px", borderRadius: 6,
        background: actionPalette.bg, color: actionPalette.color,
        border: `1px solid ${actionPalette.border}`,
        fontSize: 11.5, fontWeight: 500,
        width: "fit-content",
      }}>
        {e.action}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{
          fontSize: 13.5, fontWeight: 500,
          color: "var(--text-primary)",
          letterSpacing: "-0.005em",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {e.target}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.4 }}>
          {e.space} · {e.detail}
        </span>
      </div>
      <span style={{ justifySelf: "end" }}>
        {e.status ? <StatusBadge status={e.status} /> : (
          <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>—</span>
        )}
      </span>
    </div>
  );
};

// ── Settings sub-sidebar (matches batches 1, 4, 5) ───────────────────
const SettingsSB7 = ({ active }) => {
  const Gear = window.IconGear;
  const Users = (p) => (
    <Ic7 {...p} d={<><circle cx="9" cy="9" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M21 19a4.5 4.5 0 0 0-5-3.9" /></>} />
  );
  const Plug = (p) => (
    <Ic7 {...p} d={<><path d="M9 2v5M15 2v5" /><path d="M6 7h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V7Z" /><path d="M12 17v5" /></>} />
  );
  const nav = [
    { id: "general", icon: <Gear />, label: "Workspace" },
    { id: "members", icon: <Users />, label: "Members", count: 4 },
    { id: "keys", icon: <IconKey />, label: "API keys", count: 3 },
    { id: "integrations", icon: <Plug />, label: "Integrations", count: 2 },
    { id: "agents", icon: <IconRobot />, label: "Agent activity" },
  ];
  return (
    <aside className="sb" style={{ paddingTop: 14 }}>
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          color: "var(--text-secondary)", fontSize: 12.5,
          padding: "6px 8px 6px 4px", margin: "0 -4px 8px",
          borderRadius: 6, cursor: "pointer",
        }}>
          <span>←</span>
          <span>Tabadulat</span>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600,
          letterSpacing: "0.14em", textTransform: "uppercase",
          color: "var(--text-muted)",
        }}>
          Settings
        </div>
      </div>
      <div className="sb-nav">
        {nav.map((n) => (
          <div key={n.id} className={`sb-item ${active === n.id ? "is-active" : ""}`}>
            <span className="sb-icon">{n.icon}</span>
            <span style={{ flex: 1 }}>{n.label}</span>
            {n.count != null && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
                {n.count}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="sb-foot" style={{ borderTop: "1px solid var(--border)" }}>
        <span className="avatar avatar-ali" style={{ width: 28, height: 28 }}>A</span>
        <div className="meta">
          <div className="n">Ali Al-Mansoori</div>
          <div className="w">Admin</div>
        </div>
      </div>
    </aside>
  );
};

Object.assign(window, {
  StaleDashboard,
  Settings_AgentActivity,
});

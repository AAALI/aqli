// Aqli — Screens 4 (Review Queue), 5 (Search), 7 (Empty State)
const { Sidebar, TopBar, StatusBadge, TypeBadge, AgentChip,
  IconSearch, IconSparkle, IconArrowUpRight, IconRobot, IconChevDown,
  AqliMark, IconPlus, IconFile, IconKey, IconFolder } = window;

// ── Screen 4 — Review Queue ──────────────────────────────────────────
const REVIEW_CARDS = [
  {
    title: "Fix: Payout retry on transient bank failures",
    type: "Fix Note",
    agent: "Claude Code",
    body: "Added exponential backoff to payout transfers when the receiving bank returns a 5xx response. Previously, a single transient failure marked the payout as failed and required manual intervention from Host Support. This change retries up to 3 times over 90 minutes before escalating, and emits a `payout.retry_exhausted` event for downstream alerting.",
    foot: "1 hour ago · Triggered by PR #2418 · AIR-2398",
    diff: { added: 47, removed: 8, files: 3 },
  },
  {
    title: "Architecture: Reservation cache for hot listings",
    type: "ADR",
    agent: "Cursor Agent",
    body: "Proposes adding a Redis cache layer for high-demand listings during peak booking windows. The current approach causes elevated p95 latency on the reservation detail endpoint for listings with more than 100 nightly searches. Redis would cache 30-second windows of availability with pub/sub invalidation on price or calendar changes.",
    foot: "3 hours ago · No linked issue",
    diff: null,
  },
  {
    title: "Fix: Smart Pricing nightly recompute timeout",
    type: "Fix Note",
    agent: "Claude Code",
    body: "Extended the Smart Pricing nightly recompute job timeout from 30 minutes to 90 minutes. The job had been failing intermittently for hosts with 50+ listings since the supply expansion in Q1. Includes a feature flag for staged rollout and a Datadog monitor on job duration p99.",
    foot: "Yesterday · PR #2401 · AIR-2375",
    diff: { added: 22, removed: 14, files: 2 },
  },
];

const ReviewCard = ({ c }) => (
  <div className="card agent-row" style={{
    padding: "20px 24px 18px",
    display: "flex", flexDirection: "column", gap: 14,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em", flex: 1 }}>
        {c.title}
      </h3>
      <TypeBadge type={c.type} />
      <span className="agent-chip">
        <IconRobot size={12} />
        Written by {c.agent}
      </span>
    </div>
    <p style={{
      margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-secondary)",
    }}>
      {c.body}
    </p>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      paddingTop: 12, borderTop: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12.5, color: "var(--text-muted)" }}>
        <span>{c.foot}</span>
        {c.diff && (
          <span style={{ display: "inline-flex", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
            <span style={{ color: "var(--approved-text)" }}>+{c.diff.added}</span>
            <span style={{ color: "#993C1D" }}>−{c.diff.removed}</span>
            <span>· {c.diff.files} files</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="btn btn-ghost btn-ghost-danger">Reject</button>
        <button className="btn btn-secondary">Request Changes</button>
        <button className="btn btn-primary">Approve</button>
      </div>
    </div>
  </div>
);

const Screen4_ReviewQueue = () => (
  <div className="aqli-screen" style={{ height: 1000 }} data-screen-label="04 · Review Queue">
    <Sidebar activeNav="review" />
    <div className="main">
      <TopBar crumbs={["Review Queue"]} />
      <div className="content" style={{ padding: "28px 40px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.015em" }}>Review Queue</h1>
          <div style={{ marginTop: 4, fontSize: 13.5, color: "var(--text-secondary)" }}>
            3 docs waiting for your review
          </div>
        </div>
        <div className="fpills" style={{ marginBottom: 22 }}>
          {["All", "Fix Notes", "Architecture", "Compliance"].map((f, i) => (
            <button key={f} className={`fpill ${i === 0 ? "is-active" : ""}`}>{f}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 960 }}>
          {REVIEW_CARDS.map((c, i) => <ReviewCard key={i} c={c} />)}
        </div>
      </div>
    </div>
  </div>
);

// ── Screen 5 — Search ────────────────────────────────────────────────
const SEARCH_RESULTS = [
  {
    title: "Host Payout Schedule",
    type: "PRD", space: "Product", status: "Approved",
    excerpt: ["…The host ", "payout", " schedule defines when Airbnb releases funds to hosts after a guest checks into a reservation. Initiated 24 hours after check-in for most stays…"],
  },
  {
    title: "Fix: Payout retry on transient bank failures",
    type: "Fix Note", space: "Engineering", status: "Review", agent: true,
    excerpt: ["…Added exponential backoff to ", "payout", " transfers when the receiving bank returns a 5xx response. Previously, a single transient failure marked the payout as failed…"],
  },
  {
    title: "T&S Hold Rule 4.2 — Payout Holds",
    type: "Policy", space: "Trust & Safety", status: "Approved",
    excerpt: ["…Any ", "payout", " over $10,000 USD, or originating from a reservation flagged by anomaly detection, is held pending Trust & Safety review per Rule 4.2 §c…"],
  },
  {
    title: "Host Identity Verification Flow",
    type: "PRD", space: "Product", status: "Approved",
    excerpt: ["…Hosts must complete identity verification before receiving their first ", "payout", ". Tier 1 verification covers up to $10,000 in payouts per rolling 30 days…"],
  },
];

const Mark = ({ children }) => (
  <mark style={{
    background: "var(--review-bg)",
    color: "var(--review-text)",
    padding: "1px 3px",
    borderRadius: 3,
    fontWeight: 500,
  }}>{children}</mark>
);

const SearchResultRow = ({ r }) => (
  <div className={`${r.agent ? "agent-row" : ""}`} style={{
    padding: "16px 20px",
    border: "1px solid var(--border)",
    background: r.agent ? undefined : "var(--bg-card)",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex", flexDirection: "column", gap: 8,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>
        {r.title}
      </h4>
      <span style={{ color: "var(--text-muted)" }}><IconArrowUpRight size={13} /></span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
      <TypeBadge type={r.type} />
      <span style={{ color: "var(--text-muted)" }}>·</span>
      <span style={{ color: "var(--text-secondary)" }}>{r.space}</span>
      <span style={{ color: "var(--text-muted)" }}>·</span>
      <StatusBadge status={r.status} />
      {r.agent && (<>
        <span style={{ color: "var(--text-muted)" }}>·</span>
        <span className="agent-chip" style={{ height: 20, fontSize: 11 }}>
          <IconRobot size={11} />Agent
        </span>
      </>)}
    </div>
    <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
      {r.excerpt.map((p, i) => i === 1 ? <Mark key={i}>{p}</Mark> : <span key={i}>{p}</span>)}
    </div>
  </div>
);

const AiAnswerPanel = () => (
  <aside style={{
    width: 380, flex: "0 0 380px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "20px 22px",
    alignSelf: "flex-start",
    display: "flex", flexDirection: "column", gap: 14,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ color: "var(--accent)" }}><IconSparkle size={16} /></span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Aqli Answer</span>
      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>Synthesised</span>
    </div>
    <p style={{
      margin: 0,
      fontFamily: "var(--font-serif)",
      fontSize: 18,
      lineHeight: 1.5,
      color: "var(--text-primary)",
      letterSpacing: "-0.005em",
    }}>
      Based on 4 approved docs, host payouts are initiated 24 hours after
      guest check-in and settle within 1–5 business days. Payouts above
      $10,000 USD or flagged by anomaly detection require Trust &amp; Safety
      review per Rule 4.2. Hosts must complete identity verification before
      their first payout.
    </p>
    <div>
      <div style={{
        fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--text-muted)", fontWeight: 600, marginBottom: 8,
      }}>
        Sources
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {["Host Payout Schedule", "T&S Hold Rule 4.2", "Host Identity Verification"].map((s) => (
          <span key={s} className="tag" style={{
            background: "var(--accent-light)",
            borderColor: "rgba(15,110,86,0.18)",
            color: "var(--accent)",
            cursor: "pointer",
          }}>
            {s} <IconArrowUpRight size={11} style={{ marginLeft: 4 }} />
          </span>
        ))}
      </div>
    </div>
    <div style={{
      fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5,
      paddingTop: 10, borderTop: "1px solid var(--border)",
    }}>
      Answer generated from approved docs only. Last indexed 2 minutes ago.
    </div>
  </aside>
);

const Screen5_Search = () => (
  <div className="aqli-screen" data-screen-label="05 · Search">
    <Sidebar activeNav="search" />
    <div className="main">
      <TopBar crumbs={["Search"]} />
      <div className="content" style={{ padding: "28px 40px" }}>
        {/* Search bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0 16px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-strong)",
          borderRadius: 10,
          height: 52,
          marginBottom: 14,
          boxShadow: "0 0 0 4px rgba(15,110,86,0.06)",
        }}>
          <span style={{ color: "var(--text-secondary)" }}><IconSearch size={18} /></span>
          <input
            defaultValue="payout"
            style={{
              flex: 1, border: 0, outline: 0,
              background: "transparent",
              fontFamily: "var(--font-sans)",
              fontSize: 16, color: "var(--text-primary)",
            }}
          />
          <span style={{
            fontSize: 11, color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4,
          }}>esc</span>
        </div>
        <div className="fpills" style={{ marginBottom: 24 }}>
          {["All Spaces", "Product", "Engineering", "Compliance"].map((f, i) => (
            <button key={f} className={`fpill ${i === 0 ? "is-active" : ""}`}>{f}</button>
          ))}
          <span style={{ marginLeft: 12, fontSize: 12, color: "var(--text-muted)" }}>4 results · 38 ms</span>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            {SEARCH_RESULTS.map((r, i) => <SearchResultRow key={i} r={r} />)}
          </div>
          <AiAnswerPanel />
        </div>
      </div>
    </div>
  </div>
);

// ── Screen 7 — Empty State ───────────────────────────────────────────
const SetupCard = ({ icon, n, title, desc, cta }) => (
  <div className="card" style={{
    padding: "26px 24px 22px",
    display: "flex", flexDirection: "column", gap: 12,
    flex: 1, minWidth: 0,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: "var(--accent-light)",
        color: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</div>
      <span style={{
        fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--text-muted)", fontWeight: 600,
      }}>Step {n}</span>
    </div>
    <h3 style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>
      {title}
    </h3>
    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" }}>
      {desc}
    </p>
    <div style={{ marginTop: 6 }}>
      <a style={{
        color: "var(--accent)", fontSize: 13, fontWeight: 500,
        textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4,
        cursor: "pointer",
      }}>
        {cta} <span aria-hidden>→</span>
      </a>
    </div>
  </div>
);

const Screen7_Empty = () => (
  <div className="aqli-screen" data-screen-label="07 · Empty Workspace">
    <Sidebar />
    <div className="main">
      <TopBar crumbs={["Home"]} primary={null} />
      <div className="content" style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "40px 80px",
      }}>
        <div style={{
          maxWidth: 1080, width: "100%",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          <div style={{ marginBottom: 22 }}>
            <AqliMark size={64} />
          </div>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontSize: 44, fontWeight: 400,
            letterSpacing: "-0.015em",
            color: "var(--text-primary)",
          }}>
            Welcome to Aqli
          </h1>
          <p style={{
            margin: "10px 0 40px", fontSize: 16, color: "var(--text-secondary)",
            textAlign: "center", maxWidth: 540,
          }}>
            Set up your workspace in three steps. The shared intellect for human–agent teams.
          </p>
          <div style={{ display: "flex", gap: 16, width: "100%", maxWidth: 980 }}>
            <SetupCard
              n="01" icon={<IconFolder />}
              title="Create your first Space"
              desc="Spaces organise your docs by team or function. Start with Product, Engineering, or whatever fits."
              cta="Create a Space"
            />
            <SetupCard
              n="02" icon={<IconFile />}
              title="Write your first doc"
              desc="Add a PRD, runbook, or decision doc. Use a template to get started quickly."
              cta="New Doc"
            />
            <SetupCard
              n="03" icon={<IconKey />}
              title="Connect an agent"
              desc="Generate an API key so your AI agents can read context and write docs."
              cta="Get API Key"
            />
          </div>
          <a style={{
            marginTop: 28, fontSize: 13, color: "var(--text-muted)",
            textDecoration: "none", cursor: "pointer",
            borderBottom: "1px dashed var(--border-strong)", paddingBottom: 1,
          }}>
            Or import from Notion or Markdown files
          </a>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { Screen4_ReviewQueue, Screen5_Search, Screen7_Empty });

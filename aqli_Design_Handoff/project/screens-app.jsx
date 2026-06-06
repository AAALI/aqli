// Aqli — Screens 1, 2, 6 (App Shell, Doc List light/dark)
const { Sidebar, TopBar, StatusBadge, TypeBadge, AgentChip,
  IconChevDown, IconDots, IconRobot } = window;

// Shared doc list data ─────────────────────────────────────────────────
const ENG_DOCS = [
  { id: 1, title: "Reservation Engine Architecture", type: "ADR", status: "Approved", owner: { name: "Ali", initial: "A", cls: "avatar-ali" }, updated: "2 days ago" },
  { id: 2, title: "Fix: Payout retry on transient bank failures", type: "Fix Note", status: "Review", agent: true, agentName: "Claude Code", updated: "1 hour ago" },
  { id: 3, title: "Search Ranking Service Runbook", type: "Runbook", status: "Approved", owner: { name: "Sara", initial: "S", cls: "avatar-sara" }, updated: "5 days ago" },
  { id: 4, title: "WebSocket Connection Pooling", type: "ADR", status: "Draft", owner: { name: "Khalid", initial: "K", cls: "avatar-khalid" }, updated: "Today" },
  { id: 5, title: "Rate Limiting Strategy", type: "PRD", status: "Review", owner: { name: "Ali", initial: "A", cls: "avatar-ali" }, updated: "3 days ago" },
  { id: 6, title: "Fix: Identity Verification Status Sync", type: "Fix Note", status: "Approved", agent: true, agentName: "Claude Code", updated: "1 week ago" },
];

const DocRow = ({ d }) => (
  <div
    className="doc-row"
    style={{
      display: "grid",
      gridTemplateColumns: "90px 1fr 110px 160px 110px 28px",
      alignItems: "center",
      gap: 16,
      padding: "14px 18px",
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      borderLeft: "1px solid var(--border)",
      cursor: "pointer",
    }}
    {...(d.agent ? { className: "doc-row agent-row" } : {})}
  >
    <TypeBadge type={d.type} />
    <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>
      {d.title}
    </div>
    <StatusBadge status={d.status} />
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", fontSize: 13 }}>
      {d.agent ? (
        <>
          <span style={{
            width: 22, height: 22, borderRadius: 999,
            background: "var(--agent-tint)",
            border: "1px solid var(--agent-border)",
            color: "var(--agent-icon)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconRobot size={13} />
          </span>
          <span>{d.agentName || "Agent"}</span>
        </>
      ) : (
        <>
          <span className={`avatar avatar-sm ${d.owner.cls}`}>{d.owner.initial}</span>
          <span>{d.owner.name}</span>
        </>
      )}
    </div>
    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{d.updated}</div>
    <span style={{ color: "var(--text-muted)", display: "flex", justifyContent: "center" }}>
      <IconDots size={16} />
    </span>
  </div>
);

const SpaceHeader = ({ emoji, name, sub, filters, activeFilter = "All" }) => (
  <div style={{ marginBottom: 24 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
      <span style={{ fontSize: 28, lineHeight: 1, filter: "saturate(0.85)" }}>{emoji}</span>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: "-0.015em", color: "var(--text-primary)" }}>
        {name}
      </h1>
    </div>
    <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginLeft: 40, marginBottom: 22 }}>
      {sub}
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div className="fpills">
        {filters.map((f) => (
          <button key={f} className={`fpill ${f === activeFilter ? "is-active" : ""}`}>{f}</button>
        ))}
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-secondary)", padding: "4px 8px", borderRadius: 6, cursor: "pointer" }}>
        <span style={{ color: "var(--text-muted)" }}>Sort:</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Updated</span>
        <IconChevDown size={13} />
      </div>
    </div>
  </div>
);

// ── Screen 1 — App Shell ─────────────────────────────────────────────
const Screen1_AppShell = () => (
  <div className="aqli-screen" data-screen-label="01 · App Shell">
    <Sidebar activeNav="home" />
    <div className="main">
      <TopBar crumbs={["Home"]} />
      <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          maxWidth: 480, textAlign: "center", color: "var(--text-muted)",
          border: "1px dashed var(--border)", borderRadius: 12, padding: "44px 32px",
          background: "var(--bg-card)",
        }}>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 }}>
            App shell
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            Sidebar · Top bar · Content area. The tonal separation between sidebar and content is the primary structural element.
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ── Screen 2 — Doc List (Light) ──────────────────────────────────────
const Screen2_DocList = () => (
  <div className="aqli-screen" data-screen-label="02 · Doc List">
    <Sidebar activeSpace="engineering" />
    <div className="main">
      <TopBar crumbs={["Engineering"]} />
      <div className="content" style={{ padding: "28px 40px" }}>
        <SpaceHeader
          emoji="⚙️"
          name="Engineering"
          sub="12 docs · 2 pending review"
          filters={["All", "PRD", "ADR", "Runbook", "Fix Note"]}
          activeFilter="All"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ENG_DOCS.map((d) => <DocRow key={d.id} d={d} />)}
        </div>
      </div>
    </div>
  </div>
);

// ── Screen 6 — Doc List (Dark) ───────────────────────────────────────
const Screen6_DocListDark = () => (
  <div className="dark">
    <div className="aqli-screen" data-screen-label="06 · Doc List (Dark)">
      <Sidebar activeSpace="engineering" />
      <div className="main">
        <TopBar crumbs={["Engineering"]} />
        <div className="content" style={{ padding: "28px 40px" }}>
          <SpaceHeader
            emoji="⚙️"
            name="Engineering"
            sub="12 docs · 2 pending review"
            filters={["All", "PRD", "ADR", "Runbook", "Fix Note"]}
            activeFilter="All"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ENG_DOCS.map((d) => <DocRow key={d.id} d={d} />)}
          </div>
        </div>
      </div>
    </div>
  </div>
);

Object.assign(window, { Screen1_AppShell, Screen2_DocList, Screen6_DocListDark, DocRow, SpaceHeader, ENG_DOCS });

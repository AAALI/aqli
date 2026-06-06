// Aqli — Screen 3 — Doc Editor
const { Sidebar, TopBar, StatusBadge, TypeBadge, AgentChip,
  IconLink, IconChevDown, IconSparkle, IconRobot, IconArrowUpRight } = window;

const MetaBar = () => (
  <div style={{
    height: 44, flex: "0 0 44px",
    borderBottom: "1px solid var(--border)",
    display: "flex", alignItems: "center",
    padding: "0 40px", gap: 18,
    background: "var(--bg-base)",
    fontSize: 12.5,
  }}>
    <MetaField label="Type">
      <span className="badge badge-type" style={{ cursor: "pointer" }}>
        PRD <IconChevDown size={11} style={{ marginLeft: 4 }} />
      </span>
    </MetaField>
    <MetaField label="Status">
      <span className="badge badge-approved" style={{ cursor: "pointer" }}>
        <span className="dot"></span>Approved
        <IconChevDown size={11} style={{ marginLeft: 2 }} />
      </span>
    </MetaField>
    <MetaField label="Owner">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span className="avatar avatar-sm avatar-ali">A</span>
        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Ali</span>
      </span>
    </MetaField>
    <MetaField label="Linear">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent)", fontWeight: 500, cursor: "pointer" }}>
        <IconLink size={12} />
        AIR-2341 · Host Payout Schedule
      </span>
    </MetaField>
    <MetaField label="Tags">
      <span style={{ display: "inline-flex", gap: 4 }}>
        <span className="tag">payouts</span>
        <span className="tag">hosts</span>
        <span className="tag">settlement</span>
      </span>
    </MetaField>
    <div style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 12 }}>
      Last reviewed Jun 1, 2026
    </div>
  </div>
);

const MetaField = ({ label, children }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
    <span style={{ color: "var(--text-muted)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>
      {label}
    </span>
    {children}
  </div>
);

// Blinking cursor
const Caret = () => (
  <span style={{
    display: "inline-block",
    width: 2,
    height: "1em",
    background: "var(--accent)",
    verticalAlign: "-0.18em",
    marginLeft: 2,
    animation: "aqli-blink 1.05s steps(1) infinite",
  }}></span>
);

const EditorBody = () => (
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
        margin: "0 0 8px",
      }}>
        Host Payout Schedule
      </h1>
      <div style={{ color: "var(--text-muted)", fontSize: 13.5, marginBottom: 36, display: "flex", gap: 12, alignItems: "center" }}>
        <span>v2.4 — superseding the Sep 2025 draft</span>
      </div>

      <Section title="Overview">
        The host payout schedule defines when Airbnb releases funds to hosts
        after a guest checks into a reservation. Payouts are initiated 24 hours
        after check-in for most stays, subject to the host's payout method and
        any Trust &amp; Safety review.
      </Section>

      <Section title="Goals">
        <ul style={{ margin: "10px 0 0", paddingLeft: 22 }}>
          <li>Pay hosts within 24 hours of guest check-in for standard reservations</li>
          <li>Support all global payout methods (bank transfer, PayPal, Payoneer)</li>
          <li>Hold and escalate any payout flagged by Trust &amp; Safety</li>
        </ul>
      </Section>

      <Section title="User Flow">
        <ol style={{ margin: "10px 0 0", paddingLeft: 22 }}>
          <li>Guest checks in to the reservation (or the check-in window opens for self-check-in stays)</li>
          <li>A 24-hour hold timer starts on the reservation</li>
          <li>Payout job initiates a transfer to the host's default method via <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, background: "var(--bg-sidebar)", padding: "1px 6px", borderRadius: 4 }}>Reservations → Payouts</span></li>
          <li>Funds settle in 1–5 business days depending on method</li>
          <li>Host sees the payout on the Earnings dashboard</li>
        </ol>
      </Section>

      <Section title="Error States" caret>
        <ul style={{ margin: "10px 0 0", paddingLeft: 22 }}>
          <li><strong style={{ fontWeight: 500 }}>Payout method invalid:</strong> notify host, fall back to the bank transfer on file</li>
          <li><strong style={{ fontWeight: 500 }}>Trust &amp; Safety hold:</strong> route to the review queue, surface the reason to the host</li>
          <li><strong style={{ fontWeight: 500 }}>Bank rejection:</strong> retry once after 24h, then surface to the host</li>
        </ul>
      </Section>
    </article>
  </div>
);

const Section = ({ title, children, caret = false }) => (
  <section style={{ marginTop: 32 }}>
    <h2 style={{
      fontFamily: "var(--font-serif)",
      fontWeight: 400,
      fontSize: 26,
      letterSpacing: "-0.005em",
      margin: "0 0 6px",
    }}>
      {title}{caret && <Caret />}
    </h2>
    <div style={{ color: "var(--text-primary)" }}>
      {children}
    </div>
  </section>
);

// ── Right rail ────────────────────────────────────────────────────────
const RailPanel = ({ title, count, collapsed = false, children }) => (
  <div style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: collapsed ? 0 : 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "var(--text-secondary)",
        }}>
          {title}
        </span>
        {count !== undefined && (
          <span style={{
            fontSize: 11, color: "var(--text-muted)",
            background: "var(--bg-sidebar)",
            padding: "0 6px", borderRadius: 999, lineHeight: "16px", height: 16,
          }}>{count}</span>
        )}
      </div>
      <span style={{ color: "var(--text-muted)", cursor: "pointer" }}>
        <IconChevDown size={14} style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 120ms" }} />
      </span>
    </div>
    {!collapsed && children}
  </div>
);

const RightRail = () => (
  <aside style={{
    width: 280, flex: "0 0 280px",
    borderLeft: "1px solid var(--border)",
    background: "var(--bg-base)",
    overflow: "hidden",
  }}>
    <RailPanel title="Linked Issues" count={2}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <LinkRow code="AIR-2341" title="Host Payout Schedule" state="In Progress" stateColor="var(--accent)" />
        <LinkRow code="AIR-2398" title="Bank Method Verification" state="Done" stateColor="var(--text-muted)" />
      </div>
    </RailPanel>
    <RailPanel title="Related Docs" count={2}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <RelatedRow title="Host Identity Verification Flow" space="Trust &amp; Safety" />
        <RelatedRow title="T&amp;S Hold Rule 4.2 Reference" space="Trust &amp; Safety" />
      </div>
    </RailPanel>
    <RailPanel title="AI Summary" collapsed>
      <div style={{
        marginTop: 12,
        padding: "10px 12px",
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg-card)",
        display: "flex", alignItems: "center", gap: 8,
        fontSize: 12.5, color: "var(--text-secondary)",
        cursor: "pointer",
      }}>
        <span style={{ color: "var(--accent)" }}><IconSparkle size={14} /></span>
        Summarise this doc
      </div>
    </RailPanel>
    <RailPanel title="Contributors">
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="avatar avatar-sm avatar-ali" title="Ali">A</span>
        <span className="avatar avatar-sm avatar-sara" title="Sara">S</span>
        <span className="avatar avatar-sm avatar-khalid" title="Khalid">K</span>
        <span style={{ marginLeft: 6, fontSize: 12, color: "var(--text-muted)" }}>+2 reviewers</span>
      </div>
    </RailPanel>
  </aside>
);

const LinkRow = ({ code, title, state, stateColor }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" }}>
    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)", flex: "0 0 auto" }}>{code}</span>
    <span style={{ fontSize: 13, color: "var(--text-primary)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
    <span style={{ fontSize: 11, color: stateColor, fontWeight: 500 }}>{state}</span>
  </div>
);

const RelatedRow = ({ title, space }) => (
  <div style={{ padding: "6px 8px", margin: "0 -8px", borderRadius: 6, cursor: "pointer", display: "flex", flexDirection: "column", gap: 2 }}>
    <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{title}</span>
    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
      {space} · <span style={{ color: "var(--approved-text)" }}>Approved</span>
    </span>
  </div>
);

// ── Screen 3 ──────────────────────────────────────────────────────────
const Screen3_Editor = () => (
  <div className="aqli-screen" style={{ height: 1000 }} data-screen-label="03 · Doc Editor">
    <Sidebar activeSpace="product" />
    <div className="main">
      <TopBar
        crumbs={["Product", "Host Payout Schedule PRD"]}
        saved="Saved just now"
        primary={null}
        showShare
      />
      <MetaBar />
      <div className="main-body">
        <EditorBody />
        <RightRail />
      </div>
    </div>
    <style>{`@keyframes aqli-blink{50%{opacity:0}}`}</style>
  </div>
);

Object.assign(window, { Screen3_Editor });

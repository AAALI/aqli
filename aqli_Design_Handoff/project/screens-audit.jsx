// Aqli — Coverage Audit
// One artboard that maps every user journey from the PRD against what we've
// designed, then lists the gaps. This is a planning artifact, not a product
// screen — but it lives on the canvas so it's findable next to the work.

const { AqliMark, IconCheck, IconRobot, IconKey, IconFile, IconGear,
  IconBell, IconSearch, IconBook, IconPlus, IconArrowUpRight } = window;

// ── Status node ───────────────────────────────────────────────────────
// A flow step. state = 'done' | 'partial' | 'missing'
const Node = ({ state, label, tag }) => {
  const palette = {
    done: {
      bg: "var(--approved-bg)",
      color: "var(--approved-text)",
      border: "var(--approved-border)",
      dashed: false,
    },
    partial: {
      bg: "var(--review-bg)",
      color: "var(--review-text)",
      border: "var(--review-border)",
      dashed: false,
    },
    missing: {
      bg: "transparent",
      color: "#9E9D96",
      border: "#C9C7BE",
      dashed: true,
    },
  }[state];

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 28,
      padding: "0 11px 0 9px",
      borderRadius: 999,
      background: palette.bg,
      border: `1px ${palette.dashed ? "dashed" : "solid"} ${palette.border}`,
      color: palette.color,
      fontSize: 12.5,
      fontWeight: 500,
      letterSpacing: "-0.005em",
      whiteSpace: "nowrap",
    }}>
      {state === "done" && (
        <span style={{ display: "inline-flex" }}>
          <IconCheck size={11} sw={2.2} />
        </span>
      )}
      {state === "partial" && (
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          background: "currentColor",
          opacity: 0.7,
        }} />
      )}
      {state === "missing" && (
        <span style={{
          width: 8, height: 8, borderRadius: 999,
          border: "1.2px dashed currentColor",
        }} />
      )}
      <span>{label}</span>
      {tag && (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          opacity: 0.55,
          marginLeft: 2,
        }}>
          {tag}
        </span>
      )}
    </span>
  );
};

const Arrow = () => (
  <span style={{ color: "#C9C7BE", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>
    →
  </span>
);

const Row = ({ children }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  }}>
    {children}
  </div>
);

const JourneyRow = ({ idx, name, sub, status, children }) => {
  const statusColor = {
    covered: "var(--approved-text)",
    partial: "var(--review-text)",
    gap: "#993C1D",
  }[status];
  const statusLabel = {
    covered: "Covered",
    partial: "Partial",
    gap: "Gap",
  }[status];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "44px 220px 1fr 84px",
      gap: 20,
      alignItems: "center",
      padding: "20px 28px",
      borderBottom: "1px solid var(--border)",
    }}>
      <span style={{
        fontFamily: "var(--font-mono)",
        color: "var(--text-muted)",
        fontSize: 11.5,
        letterSpacing: "0.04em",
      }}>
        {idx}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{
          fontSize: 14,
          fontWeight: 500,
          color: "var(--text-primary)",
          letterSpacing: "-0.005em",
        }}>
          {name}
        </span>
        <span style={{
          fontSize: 12,
          color: "var(--text-muted)",
          lineHeight: 1.4,
        }}>
          {sub}
        </span>
      </div>
      <div>{children}</div>
      <span style={{
        justifySelf: "end",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: statusColor,
      }}>
        {statusLabel}
      </span>
    </div>
  );
};

// ── Gap inventory card ───────────────────────────────────────────────
const GapCard = ({ priority, color, items }) => (
  <div style={{
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "18px 20px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  }}>
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: 999,
        background: color,
      }} />
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--text-primary)",
      }}>
        {priority}
      </span>
      <span style={{
        marginLeft: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-muted)",
      }}>
        {items.length} screens
      </span>
    </div>
    {items.map((it, i) => (
      <div key={i} style={{
        padding: "10px 0",
        borderTop: i === 0 ? "none" : "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}>
        <div style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: "var(--text-primary)",
          letterSpacing: "-0.005em",
        }}>
          {it.title}
        </div>
        <div style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.45,
        }}>
          {it.desc}
        </div>
      </div>
    ))}
  </div>
);

// ── Audit screen ─────────────────────────────────────────────────────
const CoverageAudit = () => (
  <div
    data-screen-label="Coverage Audit"
    style={{
      width: 1600,
      background: "var(--bg-base)",
      color: "var(--text-primary)",
      fontFamily: "var(--font-sans)",
      padding: "44px 48px 48px",
      display: "flex",
      flexDirection: "column",
      gap: 32,
    }}
  >
    {/* Header */}
    <header style={{
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 32,
      paddingBottom: 22,
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}>
          <AqliMark size={14} />
          <span>Aqli · Planning artifact</span>
        </div>
        <h1 style={{
          margin: 0,
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: 44,
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
        }}>
          Coverage audit
        </h1>
        <p style={{
          margin: 0,
          maxWidth: 720,
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--text-secondary)",
        }}>
          Every user journey in the PRD, mapped against what we've designed.
          Anything dashed needs a screen before V1 ships.
        </p>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}>
        <Legend dot="var(--approved-text)" label="Designed" />
        <Sep />
        <Legend dot="var(--review-text)" label="Partial" />
        <Sep />
        <Legend dashed label="Missing" />
      </div>
    </header>

    {/* Journey map */}
    <section style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 28px",
        background: "var(--bg-sidebar)",
        borderBottom: "1px solid var(--border)",
        display: "grid",
        gridTemplateColumns: "44px 220px 1fr 84px",
        gap: 20,
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
      }}>
        <span>#</span>
        <span>Journey</span>
        <span>Flow</span>
        <span style={{ justifySelf: "end" }}>Status</span>
      </div>

      <JourneyRow idx="J·01" name="First-time setup"
        sub="A new admin signs up and lands in the app."
        status="covered">
        <Row>
          <Node state="done" label="Sign up" tag="OB1" />
          <Arrow />
          <Node state="done" label="Name workspace" tag="OB2" />
          <Arrow />
          <Node state="done" label="Pick spaces" tag="OB3" />
          <Arrow />
          <Node state="done" label="Connect agent" tag="OB4" />
          <Arrow />
          <Node state="done" label="Ready" tag="OB5" />
          <Arrow />
          <Node state="done" label="Empty home" tag="07" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·02" name="Returning user"
        sub="Existing teammate opens Aqli on a new device."
        status="covered">
        <Row>
          <Node state="done" label="Sign in" tag="14" />
          <Arrow />
          <Node state="done" label="Home" tag="01" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·03" name="Invited teammate"
        sub="Someone receives an invite link and joins the workspace."
        status="partial">
        <Row>
          <Node state="missing" label="Email invite" />
          <Arrow />
          <Node state="done" label="Accept invite" tag="15" />
          <Arrow />
          <Node state="done" label="Set password" tag="15" />
          <Arrow />
          <Node state="done" label="Home" tag="01" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·04" name="Browse & read a doc"
        sub="The most common daily action — find a doc, read it."
        status="covered">
        <Row>
          <Node state="done" label="Home" tag="01" />
          <Arrow />
          <Node state="done" label="Space doc list" tag="02" />
          <Arrow />
          <Node state="done" label="Doc viewer (read mode)" tag="08" />
          <Arrow />
          <Node state="done" label="Editor" tag="03" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·05" name="Create a new doc"
        sub="Pick a type, get a template, start writing."
        status="covered">
        <Row>
          <Node state="done" label="Space" tag="02" />
          <Arrow />
          <Node state="done" label="New Doc · type picker" tag="10" />
          <Arrow />
          <Node state="done" label="Template preview" tag="10" />
          <Arrow />
          <Node state="done" label="Editor (prefilled)" tag="03" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·06" name="Doc lifecycle"
        sub="Move a doc through Draft → Review → Approved → Stale."
        status="partial">
        <Row>
          <Node state="done" label="Editor" tag="03" />
          <Arrow />
          <Node state="done" label="Request review modal" tag="09" />
          <Arrow />
          <Node state="done" label="Reviewer assignment" tag="09" />
          <Arrow />
          <Node state="partial" label="Version snapshot (in rail)" tag="08" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·07" name="Review agent output"
        sub="Reviewer approves, requests changes, or rejects an agent doc."
        status="covered">
        <Row>
          <Node state="done" label="Notification" tag="11" />
          <Arrow />
          <Node state="done" label="Review queue" tag="04" />
          <Arrow />
          <Node state="done" label="Review detail (diff + comments)" tag="12" />
          <Arrow />
          <Node state="done" label="Approve" tag="27" />
          <Arrow />
          <Node state="done" label="Request changes" tag="13" />
          <Arrow />
          <Node state="done" label="Reject" tag="28" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·08" name="Search & ask"
        sub="Find an answer across approved docs with citations."
        status="covered">
        <Row>
          <Node state="done" label="Search" tag="05" />
          <Arrow />
          <Node state="done" label="Results + AI answer" tag="05" />
          <Arrow />
          <Node state="missing" label="Multi-doc Q&A chat (P1)" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·09" name="Add another AI agent"
        sub="An admin connects Cursor, GPT, or a custom agent post-onboarding."
        status="covered">
        <Row>
          <Node state="done" label="Settings" tag="SET1" />
          <Arrow />
          <Node state="done" label="API keys list" tag="SET2" />
          <Arrow />
          <Node state="done" label="New key dialog" tag="SET3" />
          <Arrow />
          <Node state="done" label="Reveal key (one-time)" tag="SET4" />
          <Arrow />
          <Node state="partial" label="Test endpoint (snippet only)" tag="SET4" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·10" name="Invite a teammate"
        sub="Admin adds a member by email and assigns a role."
        status="covered">
        <Row>
          <Node state="done" label="Settings · Members" tag="16" />
          <Arrow />
          <Node state="done" label="Invite by email" tag="16" />
          <Arrow />
          <Node state="done" label="Role select" tag="16" />
          <Arrow />
          <Node state="done" label="Pending state" tag="16" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·11" name="Add another Space"
        sub="Create a new space after onboarding."
        status="covered">
        <Row>
          <Node state="done" label="Sidebar + New Space" tag="01" />
          <Arrow />
          <Node state="done" label="Create space dialog" tag="17" />
          <Arrow />
          <Node state="done" label="Empty space" tag="18" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·12" name="Connect integrations"
        sub="Linear, Slack, GitHub — connect, scope, disconnect."
        status="covered">
        <Row>
          <Node state="done" label="Settings · Integrations" tag="19" />
          <Arrow />
          <Node state="done" label="Linear" tag="20" />
          <Arrow />
          <Node state="done" label="Slack" tag="24" />
          <Arrow />
          <Node state="done" label="GitHub" tag="25" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·13" name="Version history & audit"
        sub="Inspect what changed on a doc and who changed it."
        status="covered">
        <Row>
          <Node state="done" label="Doc viewer" tag="08" />
          <Arrow />
          <Node state="done" label="Version timeline" tag="21" />
          <Arrow />
          <Node state="done" label="Diff view + restore" tag="21" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·14" name="Stale doc hygiene (P1)"
        sub="Quarterly cleanup — flag docs not reviewed in 90 days."
        status="covered">
        <Row>
          <Node state="done" label="Stale dashboard" tag="22" />
          <Arrow />
          <Node state="done" label="Bulk select + actions" tag="22" />
          <Arrow />
          <Node state="done" label="Agent refresh hint" tag="22" />
        </Row>
      </JourneyRow>

      <JourneyRow idx="J·15" name="Notifications (P1)"
        sub="Bell icon panel — review requests, mentions, status changes."
        status="covered">
        <Row>
          <Node state="done" label="Bell with dot" tag="topbar" />
          <Arrow />
          <Node state="done" label="Notifications panel" tag="11" />
          <Arrow />
          <Node state="done" label="Notification settings" tag="26" />
        </Row>
      </JourneyRow>

      <div style={{ padding: "16px 28px", background: "var(--bg-sidebar)" }}>
        <Summary />
      </div>
    </section>

    {/* Gap inventory */}
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h2 style={{
          margin: 0,
          fontFamily: "var(--font-serif)",
          fontWeight: 400,
          fontSize: 28,
          letterSpacing: "-0.015em",
          color: "var(--text-primary)",
        }}>
          Future work · V1.2 and beyond
        </h2>
        <span style={{
          fontSize: 12.5,
          color: "var(--text-secondary)",
        }}>
          Out of scope for this release. Picked up as the product evolves.
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        alignItems: "start",
      }}>
        <GapCard
          priority="Deferred to product evolution"
          color="#6B6A64"
          items={[
            { title: "Email invite template", desc: "Plaintext + HTML body of the invite email. Marketing-style mock when brand copy is ready." },
            { title: "Mobile shell", desc: "Aqli is desktop-first by design. Add a phone-shaped read-only viewer when usage warrants it." },
          ]}
        />

        <GapCard
          priority="PRD P1 · future"
          color="#854F0B"
          items={[
            { title: "Multi-doc Q&A chat", desc: "Conversation surface on top of /context. Adds memory + multi-turn to today's single-shot search." },
            { title: "Public space", desc: "Opt-in: publish a space to a read-only public URL. Useful for docs your customers read." },
            { title: "Audit export (SOC2)", desc: "CSV/JSON export of every doc lifecycle + agent event. Enterprise-only." },
          ]}
        />
      </div>
    </section>

    {/* Footer recommendation */}
    <section style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "22px 28px",
      display: "flex",
      gap: 28,
      alignItems: "center",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: "var(--accent-light)",
        color: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flex: "0 0 44px",
      }}>
        <IconArrowUpRight size={20} sw={1.8} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 13.5,
          fontWeight: 500,
          color: "var(--text-primary)",
          marginBottom: 4,
          letterSpacing: "-0.005em",
        }}>
          V1.1 shipped — 28 screens, every PRD journey 100% covered
        </div>
        <div style={{
          fontSize: 13,
          color: "var(--text-secondary)",
          lineHeight: 1.55,
        }}>
          Slack and GitHub integration detail pages, the personal notification preferences matrix, and the Approve / Reject confirm modals all landed. The design is ready for engineering handoff via Claude Code.
        </div>
      </div>
    </section>
  </div>
);

// ── Bottom-row summary stats (inside the journey map card) ────────────
const Summary = () => {
  const counts = [
    { label: "Journeys mapped", value: 15, color: "var(--text-primary)" },
    { label: "Covered", value: 15, color: "var(--approved-text)" },
    { label: "Partial", value: 0, color: "var(--review-text)" },
    { label: "Gaps", value: 0, color: "#993C1D" },
  ];
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 32,
      fontSize: 12.5,
    }}>
      {counts.map((c, i) => (
        <React.Fragment key={i}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{
              fontFamily: "var(--font-serif)",
              fontSize: 22,
              fontWeight: 400,
              color: c.color,
              lineHeight: 1,
            }}>
              {c.value}
            </span>
            <span style={{ color: "var(--text-secondary)" }}>{c.label}</span>
          </div>
          {i < counts.length - 1 && (
            <span style={{ color: "var(--border-strong)" }}>·</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── Header legend ────────────────────────────────────────────────────
const Legend = ({ dot, dashed, label }) => (
  <span style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontSize: 12,
    color: "var(--text-secondary)",
  }}>
    <span style={{
      width: 10, height: 10, borderRadius: 999,
      background: dot ?? "transparent",
      border: dashed ? "1.2px dashed #9E9D96" : "none",
    }} />
    <span>{label}</span>
  </span>
);

const Sep = () => (
  <span style={{ width: 1, height: 14, background: "var(--border)" }} />
);

Object.assign(window, { CoverageAudit });

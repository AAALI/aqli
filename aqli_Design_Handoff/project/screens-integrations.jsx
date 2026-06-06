// Aqli — Integrations + Version history (Batch 5)
// Closes J·12 (integrations), J·13 (version history).

const { Sidebar, TopBar, StatusBadge, IconChevDown, IconDots, IconCheck,
  IconArrowUpRight, IconClose, IconLink, IconRobot, IconKey, IconBell,
  IconPlus, IconFile, IconBook, AqliMark } = window;

const Ic6 = ({ d, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IconExternal = (p) => (
  <Ic6 {...p} d={<><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>} sw={1.7} />
);
const IconBranch2 = (p) => (
  <Ic6 {...p} d={<><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="9" r="2" /><path d="M6 7v10" /><path d="M6 14a6 6 0 0 0 6-6h4" /></>} />
);
const IconHistory = (p) => (
  <Ic6 {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /><path d="M3 7h6V1" /></>} />
);
const IconArrowDown = (p) => (
  <Ic6 {...p} d={<><path d="M12 5v14M6 13l6 6 6-6" /></>} sw={1.7} />
);

// ── Brand logos (rendered with shape, not bitmaps) ────────────────────
const LinearLogo = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <defs>
      <linearGradient id="lin-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#5E6AD2" />
        <stop offset="100%" stopColor="#3B49C3" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#lin-grad)" />
    <path d="M5 19 19 5M5 14 14 5M5 9 9 5M10 19 19 10M15 19 19 15" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
  </svg>
);
const SlackLogo = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#3F0F3F" />
    <g transform="translate(5 5)">
      <rect x="0" y="2" width="3" height="6" rx="1.5" fill="#36C5F0" />
      <rect x="2" y="0" width="6" height="3" rx="1.5" fill="#2EB67D" />
      <rect x="6" y="2" width="3" height="6" rx="1.5" fill="#ECB22E" />
      <rect x="2" y="6" width="6" height="3" rx="1.5" fill="#E01E5A" />
    </g>
  </svg>
);
const GitHubLogo = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#1A1A18" />
    <path d="M12 5a5 5 0 0 0-1.6 9.7c.3.1.4-.1.4-.3v-1c-1.4.3-1.7-.7-1.7-.7-.2-.6-.6-.7-.6-.7-.5-.3 0-.3 0-.3.6 0 .9.6.9.6.5.9 1.3.6 1.6.5 0-.4.2-.6.4-.8-1.1-.1-2.3-.6-2.3-2.5 0-.5.2-1 .5-1.3 0-.2-.2-.7.1-1.4 0 0 .4-.1 1.4.5a4.7 4.7 0 0 1 2.5 0c.9-.6 1.4-.5 1.4-.5.3.7.1 1.2.1 1.4.3.3.5.8.5 1.3 0 1.9-1.2 2.3-2.3 2.5.2.2.4.5.4 1V14.4c0 .2 0 .4.4.3A5 5 0 0 0 12 5Z" fill="#fff" />
  </svg>
);
const McpLogo = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#0F6E56" />
    <path d="M7 17V8l3 4 3-4v9M14 13h4M14 17h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// ── Settings sub-sidebar (mirrors batches 1 & 4) ────────────────────
const SettingsSB = ({ active }) => {
  const Gear = window.IconGear;
  const Users = (p) => (
    <Ic6 {...p} d={<><circle cx="9" cy="9" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M21 19a4.5 4.5 0 0 0-5-3.9" /></>} />
  );
  const Plug = (p) => (
    <Ic6 {...p} d={<><path d="M9 2v5M15 2v5" /><path d="M6 7h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V7Z" /><path d="M12 17v5" /></>} />
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

const SetHead = ({ title, sub, action }) => (
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
        {title}
      </h1>
      {sub && (
        <p style={{ margin: 0, maxWidth: 620, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>
          {sub}
        </p>
      )}
    </div>
    {action}
  </header>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN A — Settings · Integrations list
// ─────────────────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    id: "linear",
    logo: <LinearLogo size={36} />,
    name: "Linear",
    desc: "Link docs to projects and issues. Detect Linear URLs in doc bodies and show inline previews.",
    status: "connected",
    meta: "Tabadulat workspace · 3 projects synced · auto-detect URLs on",
    actor: { name: "Ali", initial: "A", cls: "avatar-ali" },
  },
  {
    id: "slack",
    logo: <SlackLogo size={36} />,
    name: "Slack",
    desc: "Post notifications to a channel: review requests, approvals, stale-doc alerts.",
    status: "connected",
    meta: "Tabadulat workspace · #doc-review · 4 event types",
    actor: { name: "Sara", initial: "S", cls: "avatar-sara" },
  },
  {
    id: "github",
    logo: <GitHubLogo size={36} />,
    name: "GitHub",
    desc: "Mirror docs to a repo as Markdown. Agents can commit alongside Aqli writes.",
    status: "available",
    meta: "Lets you keep a Git-native copy of your knowledge base.",
  },
  {
    id: "mcp",
    logo: <McpLogo size={36} />,
    name: "MCP server",
    desc: "Expose your Aqli context to any MCP-compatible agent natively, without an API key.",
    status: "available",
    meta: "Recommended if you use Claude Desktop, Zed, or Cursor's MCP support.",
    badge: "New",
  },
];

const Settings_Integrations = () => (
  <div className="aqli-screen" data-screen-label="19 · Settings · Integrations">
    <SettingsSB active="integrations" />
    <div className="main">
      <TopBar crumbs={["Settings", "Integrations"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
        <SetHead
          title="Integrations"
          sub="Connect Aqli to the tools your team already uses. Each integration is workspace-scoped and can be revoked at any time."
        />

        {/* Connected summary strip */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          marginBottom: 26,
          overflow: "hidden",
        }}>
          <IStat label="Connected" value="2" />
          <IStat label="URLs auto-detected" value="38" hint="across 12 docs" />
          <IStat label="Slack posts · 7d" value="14" hint="review requests + approvals" />
          <IStat label="Most recent" value="Linear" hint="Jun 1 · TAB-441" last />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {INTEGRATIONS.map((it) => <IntegrationCard key={it.id} it={it} />)}
        </div>

        <div style={{
          marginTop: 28,
          padding: "16px 20px",
          background: "var(--bg-sidebar)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{
            width: 28, height: 28, borderRadius: 6,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--text-secondary)",
          }}>
            <IconBook size={14} />
          </span>
          <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Want an integration that isn't here? Aqli's storage layer can be swapped to{" "}
            <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>GitHub, Supabase, or local Postgres</strong>{" "}
            via the .env config. See self-hosting docs.
          </div>
          <span style={{ color: "var(--text-secondary)", display: "flex" }}>
            <IconArrowUpRight size={14} />
          </span>
        </div>
      </div>
    </div>
  </div>
);

const IStat = ({ label, value, hint, last }) => (
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
      color: "var(--text-primary)", lineHeight: 1.1,
    }}>{value}</span>
    {hint && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{hint}</span>}
  </div>
);

const IntegrationCard = ({ it }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "44px 1fr auto",
    gap: 18, alignItems: "center",
    padding: "20px 22px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
  }}>
    {it.logo}

    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          fontSize: 15, fontWeight: 500,
          color: "var(--text-primary)", letterSpacing: "-0.005em",
        }}>
          {it.name}
        </span>
        {it.status === "connected" && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            height: 22, padding: "0 8px", borderRadius: 6,
            background: "var(--approved-bg)", color: "var(--approved-text)",
            border: "1px solid var(--approved-border)",
            fontSize: 11.5, fontWeight: 500,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
            Connected
          </span>
        )}
        {it.badge && (
          <span style={{
            height: 22, padding: "0 8px", borderRadius: 6,
            background: "var(--accent-light)", color: "var(--accent)",
            border: "1px solid rgba(15,110,86,0.25)",
            fontSize: 11.5, fontWeight: 500,
            display: "inline-flex", alignItems: "center",
          }}>
            {it.badge}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {it.desc}
      </div>
      <div style={{
        fontSize: 12, color: "var(--text-muted)",
        display: "flex", alignItems: "center", gap: 8,
        marginTop: 2,
      }}>
        {it.status === "connected" && it.actor && (
          <>
            <span className={`avatar avatar-sm ${it.actor.cls}`} style={{ width: 18, height: 18, fontSize: 9 }}>
              {it.actor.initial}
            </span>
            <span>Connected by {it.actor.name}</span>
            <span>·</span>
          </>
        )}
        <span>{it.meta}</span>
      </div>
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {it.status === "connected" ? (
        <>
          <button className="btn btn-secondary">Configure</button>
          <span style={{ color: "var(--text-muted)", cursor: "pointer", padding: 4 }}>
            <IconDots size={16} />
          </span>
        </>
      ) : (
        <button className="btn btn-primary">
          <span>Connect</span>
          <IconExternal size={12} />
        </button>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN B — Linear integration detail
// ─────────────────────────────────────────────────────────────────────

const LINEAR_PROJECTS = [
  { code: "TAB", name: "Tabadulat — Core platform", issues: 142, on: true },
  { code: "TAB-OPS", name: "Tabadulat — Ops & Tooling", issues: 38, on: true },
  { code: "TAB-TS", name: "Tabadulat — Trust & Safety", issues: 22, on: true },
  { code: "WIK", name: "Wikime", issues: 84, on: false },
  { code: "SIRO", name: "SIRO & CO — Internal", issues: 17, on: false },
];

const Settings_Integrations_Linear = () => (
  <div className="aqli-screen" data-screen-label="20 · Linear · Configure">
    <SettingsSB active="integrations" />
    <div className="main">
      <TopBar crumbs={["Settings", "Integrations", "Linear"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
        {/* Breadcrumb / back */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          fontSize: 12.5, color: "var(--text-secondary)",
          padding: "4px 8px", margin: "0 -8px 16px",
          borderRadius: 6, cursor: "pointer",
          width: "fit-content",
        }}>
          <span>←</span>
          <span>All integrations</span>
        </div>

        {/* Hero */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 16,
          paddingBottom: 22, marginBottom: 24,
          borderBottom: "1px solid var(--border)",
        }}>
          <LinearLogo size={48} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{
                margin: 0, fontFamily: "var(--font-serif)",
                fontWeight: 400, fontSize: 30,
                letterSpacing: "-0.015em",
              }}>
                Linear
              </h1>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 22, padding: "0 8px", borderRadius: 6,
                background: "var(--approved-bg)", color: "var(--approved-text)",
                border: "1px solid var(--approved-border)",
                fontSize: 11.5, fontWeight: 500,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
                Connected to <strong style={{ fontWeight: 600 }}>tabadulat</strong>
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", maxWidth: 720, lineHeight: 1.55 }}>
              Aqli reads your Linear projects and issues. Paste a Linear URL into any doc and Aqli will show an inline preview with status, assignee, and a deep link.
            </p>
          </div>
          <button className="btn btn-secondary" style={{ color: "#993C1D" }}>
            Disconnect
          </button>
        </div>

        {/* Sections */}
        <SettingsCard6 title="Behaviour"
          sub="What Aqli does when it sees a Linear URL or links a doc to an issue.">
          <ToggleRow label="Detect Linear URLs in doc bodies" desc="Wrap raw URLs into rich preview cards with status, assignee, and deep link." on />
          <ToggleRow label="Add Aqli link back to Linear" desc="When a doc is linked to an issue, post a back-link comment on the Linear issue." on />
          <ToggleRow label="Auto-mark Aqli docs as 'In Progress' source" desc="When the linked Linear issue moves to In Progress, mark the doc as actively referenced." />
        </SettingsCard6>

        <SettingsCard6 title="Project sync"
          sub="Only docs linked to projects you sync will get rich previews. Synced projects: 3 of 5.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {LINEAR_PROJECTS.map((p, i) => <ProjectRow key={i} p={p} />)}
          </div>
        </SettingsCard6>

        <SettingsCard6 title="Default link behaviour"
          sub="When agents create a Fix Note, how should they link back to Linear?">
          <RadioRow on label="Link to triggering issue" desc="If the agent was given a Linear issue as input, the new doc links to that issue automatically." />
          <RadioRow label="Prompt the agent each time" desc="Agent must explicitly include linear_issue_id in the create-doc call." />
          <RadioRow label="No automatic linking" desc="Aqli will not add Linear links to agent-authored docs." />
        </SettingsCard6>
      </div>
    </div>
  </div>
);

const SettingsCard6 = ({ title, sub, children }) => (
  <section style={{
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "22px 24px",
    marginBottom: 18,
    display: "flex", flexDirection: "column", gap: 14,
  }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h3 style={{
        margin: 0, fontSize: 15, fontWeight: 500,
        color: "var(--text-primary)", letterSpacing: "-0.005em",
      }}>
        {title}
      </h3>
      {sub && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {sub}
        </p>
      )}
    </div>
    {children}
  </section>
);

const ToggleRow = ({ label, desc, on }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "1fr 40px",
    gap: 16, alignItems: "center",
    padding: "10px 0",
    borderTop: "1px solid var(--border)",
  }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>{desc}</span>
    </div>
    <span style={{
      width: 32, height: 18, borderRadius: 999,
      background: on ? "var(--accent)" : "var(--border-strong)",
      position: "relative", justifySelf: "end",
    }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: 999,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }} />
    </span>
  </div>
);

const RadioRow = ({ label, desc, on }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "20px 1fr",
    gap: 12, alignItems: "start",
    padding: "10px 12px",
    background: on ? "var(--accent-light)" : "var(--bg-base)",
    border: `1px solid ${on ? "rgba(15,110,86,0.3)" : "var(--border)"}`,
    borderRadius: 8,
  }}>
    <span style={{
      width: 16, height: 16, borderRadius: 999,
      border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
      background: on ? "var(--accent)" : "transparent",
      position: "relative", marginTop: 2,
    }}>
      {on && <span style={{ position: "absolute", top: 3, left: 3, width: 7, height: 7, borderRadius: 999, background: "#fff" }} />}
    </span>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: on ? "var(--accent)" : "var(--text-primary)" }}>{label}</span>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{desc}</span>
    </div>
  </div>
);

const ProjectRow = ({ p }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "40px 1fr auto 36px",
    gap: 14, alignItems: "center",
    padding: "10px 14px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 8,
  }}>
    <span style={{
      width: 32, height: 32, borderRadius: 6,
      background: p.on ? "rgba(94,106,210,0.12)" : "var(--bg-sidebar)",
      color: p.on ? "#3B49C3" : "var(--text-muted)",
      border: `1px solid ${p.on ? "rgba(94,106,210,0.25)" : "var(--border)"}`,
      fontFamily: "var(--font-mono)",
      fontSize: 9.5, fontWeight: 600,
      letterSpacing: "0.04em",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      {p.code}
    </span>
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</span>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        {p.issues} issues · {p.on ? "synced 4 minutes ago" : "not syncing"}
      </span>
    </div>
    <span style={{ fontSize: 11.5, color: p.on ? "var(--approved-text)" : "var(--text-muted)" }}>
      {p.on ? "Synced" : "Available"}
    </span>
    <span style={{
      width: 32, height: 18, borderRadius: 999,
      background: p.on ? "var(--accent)" : "var(--border-strong)",
      position: "relative", justifySelf: "end",
    }}>
      <span style={{
        position: "absolute", top: 2, left: p.on ? 16 : 2,
        width: 14, height: 14, borderRadius: 999,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }} />
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN C — Version history (J·13)
// ─────────────────────────────────────────────────────────────────────

const VERSIONS = [
  {
    n: 4, kind: "approved",
    note: "Status changed to Approved",
    who: { name: "Ali", initial: "A", cls: "avatar-ali" },
    when: "Jun 1 · 14:22",
    delta: "+8 / −2 lines",
    current: true,
  },
  {
    n: 3, kind: "review",
    note: "Reviewed — requested changes",
    sub: "Sara: 'Tighten T&S section, clarify threshold.'",
    who: { name: "Sara", initial: "S", cls: "avatar-sara" },
    when: "May 28 · 11:08",
    delta: "+0 / −0 lines",
  },
  {
    n: 3, kind: "edit",
    note: "Refined §3 — error handling",
    who: { name: "Ali", initial: "A", cls: "avatar-ali" },
    when: "May 27 · 09:41",
    delta: "+22 / −6 lines",
  },
  {
    n: 2, kind: "agent",
    note: "Updated diagram references",
    sub: "Auto-update from linked Linear issue TAB-234",
    who: { name: "Claude Code", initial: null, agent: true },
    when: "May 20 · 03:14",
    delta: "+4 / −4 lines",
  },
  {
    n: 1, kind: "create",
    note: "Created from PRD template",
    who: { name: "Ali", initial: "A", cls: "avatar-ali" },
    when: "May 15 · 10:00",
    delta: "+112 lines",
  },
];

const VersionHistory = () => (
  <div className="aqli-screen" style={{ height: 1100 }} data-screen-label="21 · Version history">
    <Sidebar activeSpace="product" />
    <div className="main">
      <TopBar crumbs={["Product", "AED Withdrawal Flow", "Version history"]} primary={null} showShare={false} />

      {/* Doc context bar */}
      <div style={{
        flex: "0 0 56px", height: 56,
        padding: "0 32px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-base)",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <h2 style={{
          margin: 0,
          fontFamily: "var(--font-serif)",
          fontWeight: 400, fontSize: 20,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
        }}>
          AED Withdrawal Flow
        </h2>
        <span style={{ color: "var(--border-strong)" }}>|</span>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
          5 versions · created May 15 · last edit Jun 1
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
          Comparing <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>v3</strong> → <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>v4</strong>
        </span>
        <button className="btn btn-secondary">
          <IconArrowDown size={13} />
          <span>Export diff</span>
        </button>
      </div>

      <div className="main-body">
        {/* Timeline */}
        <aside style={{
          width: 340, flex: "0 0 340px",
          borderRight: "1px solid var(--border)",
          background: "var(--bg-card)",
          overflow: "auto",
          padding: "20px 0 0",
        }}>
          <div style={{ padding: "0 20px 12px" }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--text-muted)",
            }}>
              Timeline
            </div>
          </div>
          <div style={{ position: "relative", padding: "0 0 24px 0" }}>
            <div style={{
              position: "absolute",
              left: 36, top: 8, bottom: 36,
              width: 1, background: "var(--border)",
            }} />
            {VERSIONS.map((v, i) => <VersionRow key={i} v={v} selected={v.kind === "approved" || (v.n === 3 && v.kind === "edit")} />)}
          </div>
        </aside>

        {/* Diff */}
        <div style={{
          flex: 1, overflow: "hidden",
          padding: "28px 32px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              padding: "4px 10px", borderRadius: 6,
              background: "var(--bg-sidebar)", border: "1px solid var(--border)",
              fontSize: 12, fontFamily: "var(--font-mono)",
              color: "var(--text-secondary)",
            }}>
              v3
            </span>
            <span style={{ color: "var(--text-muted)" }}>→</span>
            <span style={{
              padding: "4px 10px", borderRadius: 6,
              background: "var(--accent-light)", border: "1px solid rgba(15,110,86,0.25)",
              fontSize: 12, fontFamily: "var(--font-mono)",
              color: "var(--accent)", fontWeight: 500,
            }}>
              v4 · current
            </span>
            <div style={{ flex: 1 }} />
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 14,
              fontSize: 12,
            }}>
              <span style={{ color: "var(--approved-text)", fontFamily: "var(--font-mono)" }}>+8</span>
              <span style={{ color: "#993C1D", fontFamily: "var(--font-mono)" }}>−2</span>
              <span style={{ color: "var(--text-muted)" }}>1 file</span>
            </div>
            <button className="btn btn-secondary" style={{ marginLeft: 8 }}>
              <IconHistory size={13} />
              <span>Restore v3</span>
            </button>
          </div>

          {/* Diff content */}
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "auto",
            flex: 1,
            padding: "20px 24px",
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            lineHeight: 1.7,
            color: "var(--text-primary)",
          }}>
            <DiffHunk path="## Goals" />
            <DiffRow ctx>Pay hosts within 24 hours of guest check-in for standard reservations</DiffRow>
            <DiffRow remove>{"- Hold and review any withdrawal over $10,000 USD"}</DiffRow>
            <DiffRow add>{"+ Hold and review any withdrawal flagged by anomaly detection or above the AED 36,700 threshold"}</DiffRow>
            <DiffRow ctx>Support all global payout methods (bank transfer, PayPal, Payoneer)</DiffRow>

            <div style={{ height: 18 }} />

            <DiffHunk path="## Error states" />
            <DiffRow ctx>{"- **Bank rejection:** retry once after 24h, then surface to the host"}</DiffRow>
            <DiffRow remove>{"- **T&S hold:** route to the review queue"}</DiffRow>
            <DiffRow add>{"+ **T&S hold:** route to the review queue per Rule 4.2 §c, hold up to 5 business days"}</DiffRow>
            <DiffRow add>{"+ **Tier limit exceeded:** block at request time; show current tier and upgrade path"}</DiffRow>

            <div style={{ height: 18 }} />

            <DiffHunk path="## Verification" subtitle="(new section)" />
            <DiffRow add>{"+ ## Verification"}</DiffRow>
            <DiffRow add>{"+ Backfilled the eleven affected payouts manually through the admin tool,"}</DiffRow>
            <DiffRow add>{"+ all settled by Jun 5 09:00 GST. Synthetic test runs against the bank"}</DiffRow>
            <DiffRow add>{"+ sandbox confirm the new retry policy fires correctly on 502/503/504."}</DiffRow>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const VersionRow = ({ v, selected }) => {
  const dotColor = {
    approved: "var(--approved-text)",
    review: "var(--review-text)",
    edit: "var(--text-primary)",
    agent: "var(--agent-icon)",
    create: "var(--text-muted)",
  }[v.kind];
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "36px 1fr",
      gap: 14, alignItems: "start",
      padding: "10px 20px 10px 0",
      marginLeft: 0,
      background: selected ? "var(--bg-sidebar)" : "transparent",
      borderRight: selected ? "2px solid var(--accent)" : "2px solid transparent",
      cursor: "pointer",
    }}>
      <div style={{ position: "relative", display: "flex", justifyContent: "center", paddingTop: 4 }}>
        <span style={{
          width: 10, height: 10, borderRadius: 999,
          background: "var(--bg-card)",
          border: `2px solid ${dotColor}`,
          boxShadow: selected ? "0 0 0 4px rgba(15,110,86,0.15)" : "none",
          zIndex: 1,
        }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11.5,
            color: "var(--text-muted)", fontWeight: 500,
          }}>
            v{v.n}
          </span>
          {v.current && (
            <span style={{
              fontSize: 10, color: "var(--accent)",
              padding: "0 6px", height: 16,
              borderRadius: 3,
              background: "var(--accent-light)",
              border: "1px solid rgba(15,110,86,0.25)",
              display: "inline-flex", alignItems: "center",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}>
              current
            </span>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.when}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, letterSpacing: "-0.005em" }}>
          {v.note}
        </div>
        {v.sub && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.45 }}>
            {v.sub}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {v.who.agent ? (
            <>
              <span style={{
                width: 18, height: 18, borderRadius: 999,
                background: "var(--agent-tint)",
                border: "1px solid var(--agent-border)",
                color: "var(--agent-icon)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconRobot size={10} />
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{v.who.name}</span>
            </>
          ) : (
            <>
              <span className={`avatar avatar-sm ${v.who.cls}`} style={{ width: 18, height: 18, fontSize: 9 }}>
                {v.who.initial}
              </span>
              <span style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{v.who.name}</span>
            </>
          )}
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
            {v.delta}
          </span>
        </div>
      </div>
    </div>
  );
};

const DiffHunk = ({ path, subtitle }) => (
  <div style={{
    padding: "6px 12px", margin: "0 -12px 6px",
    background: "var(--bg-sidebar)",
    borderRadius: 4,
    fontSize: 11.5, color: "var(--text-secondary)",
    fontFamily: "var(--font-mono)",
    display: "flex", alignItems: "center", gap: 8,
  }}>
    <span style={{ color: "var(--text-muted)" }}>@@</span>
    <span style={{ fontWeight: 500 }}>{path}</span>
    {subtitle && (
      <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{subtitle}</span>
    )}
  </div>
);

const DiffRow = ({ children, add, remove, ctx }) => (
  <div style={{
    padding: "1px 12px", margin: "0 -12px",
    background: add ? "rgba(15,110,86,0.08)"
      : remove ? "rgba(153,60,29,0.08)"
      : "transparent",
    color: add ? "var(--approved-text)"
      : remove ? "#993C1D"
      : "var(--text-secondary)",
    borderLeft: `3px solid ${add ? "var(--accent)" : remove ? "#993C1D" : "transparent"}`,
    whiteSpace: "pre",
    overflow: "hidden",
    textOverflow: "ellipsis",
  }}>
    {children}
  </div>
);

Object.assign(window, {
  Settings_Integrations,
  Settings_Integrations_Linear,
  VersionHistory,
});

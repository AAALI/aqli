// Aqli — V1.1 polish batch
// Five screens that close out the deferred items from V1:
//   24 · Slack configure detail        (mirrors Linear pattern)
//   25 · GitHub configure detail       (mirrors Linear pattern)
//   26 · Notification settings page
//   27 · Review · Approve confirm
//   28 · Review · Reject confirm

const { Sidebar, TopBar, StatusBadge, AgentChip,
  IconChevDown, IconDots, IconRobot, IconCheck, IconArrowUpRight,
  IconKey, IconBell, IconBook, IconClose, IconFile, IconPlus,
  IconSparkle, IconLink } = window;

const Ic8 = ({ d, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IconExt = (p) => <Ic8 {...p} d={<><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>} sw={1.7} />;
const IconX2 = (p) => <Ic8 {...p} d={<><path d="M6 6l12 12M18 6 6 18" /></>} sw={1.8} />;
const IconWarn2 = (p) => <Ic8 {...p} d={<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v5M12 17.5v.2" /></>} />;
const IconMail2 = (p) => <Ic8 {...p} d={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>} />;
const IconHash = (p) => <Ic8 {...p} d={<><path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" /></>} />;
const IconLock = (p) => <Ic8 {...p} d={<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>} />;
const IconSlash = (p) => <Ic8 {...p} d={<path d="M16 4 8 20" />} sw={1.8} />;

// Brand logos (matching the previous Integrations card)
const SlackLogo2 = ({ size = 48 }) => (
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
const GitHubLogo2 = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect width="24" height="24" rx="6" fill="#1A1A18" />
    <path d="M12 5a5 5 0 0 0-1.6 9.7c.3.1.4-.1.4-.3v-1c-1.4.3-1.7-.7-1.7-.7-.2-.6-.6-.7-.6-.7-.5-.3 0-.3 0-.3.6 0 .9.6.9.6.5.9 1.3.6 1.6.5 0-.4.2-.6.4-.8-1.1-.1-2.3-.6-2.3-2.5 0-.5.2-1 .5-1.3 0-.2-.2-.7.1-1.4 0 0 .4-.1 1.4.5a4.7 4.7 0 0 1 2.5 0c.9-.6 1.4-.5 1.4-.5.3.7.1 1.2.1 1.4.3.3.5.8.5 1.3 0 1.9-1.2 2.3-2.3 2.5.2.2.4.5.4 1V14.4c0 .2 0 .4.4.3A5 5 0 0 0 12 5Z" fill="#fff" />
  </svg>
);

// ─────────────────────────────────────────────────────────────────────
// Settings sidebar (matches batches 1/4/5/6)
// ─────────────────────────────────────────────────────────────────────
const SettingsSB8 = ({ active }) => {
  const Gear = window.IconGear;
  const Users = (p) => (
    <Ic8 {...p} d={<><circle cx="9" cy="9" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M21 19a4.5 4.5 0 0 0-5-3.9" /></>} />
  );
  const Plug = (p) => (
    <Ic8 {...p} d={<><path d="M9 2v5M15 2v5" /><path d="M6 7h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V7Z" /><path d="M12 17v5" /></>} />
  );
  const Notify = (p) => (
    <Ic8 {...p} d={<><path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>} />
  );
  const nav = [
    { id: "general", icon: <Gear />, label: "Workspace" },
    { id: "members", icon: <Users />, label: "Members", count: 4 },
    { id: "keys", icon: <IconKey />, label: "API keys", count: 3 },
    { id: "integrations", icon: <Plug />, label: "Integrations", count: 2 },
    { id: "notifications", icon: <Notify />, label: "Notifications" },
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

// Shared primitives ─────────────────────────────────────────────────
const Card8 = ({ title, sub, children }) => (
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
      }}>{title}</h3>
      {sub && (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {sub}
        </p>
      )}
    </div>
    {children}
  </section>
);

const Toggle8 = ({ label, desc, on }) => (
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

const SetHead8 = ({ logo, title, status, sub, action }) => (
  <header style={{
    display: "flex", alignItems: "flex-start",
    gap: 16, paddingBottom: 22, marginBottom: 24,
    borderBottom: "1px solid var(--border)",
  }}>
    {logo}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h1 style={{
          margin: 0, fontFamily: "var(--font-serif)",
          fontWeight: 400, fontSize: 30,
          letterSpacing: "-0.015em",
        }}>
          {title}
        </h1>
        {status}
      </div>
      <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", maxWidth: 720, lineHeight: 1.55 }}>
        {sub}
      </p>
    </div>
    {action}
  </header>
);

const ConnectedChip = ({ to }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    height: 22, padding: "0 8px", borderRadius: 6,
    background: "var(--approved-bg)", color: "var(--approved-text)",
    border: "1px solid var(--approved-border)",
    fontSize: 11.5, fontWeight: 500,
  }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
    Connected to <strong style={{ fontWeight: 600 }}>{to}</strong>
  </span>
);

const BackLink = ({ label }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 8,
    fontSize: 12.5, color: "var(--text-secondary)",
    padding: "4px 8px", margin: "0 -8px 16px",
    borderRadius: 6, cursor: "pointer",
    width: "fit-content",
  }}>
    <span>←</span><span>{label}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// 24 · SLACK configure
// ─────────────────────────────────────────────────────────────────────
const SLACK_EVENTS = [
  { id: "review",   name: "Review requested",     desc: "Sent when an agent or human asks for review on a doc",     channel: "#doc-review",   icon: <IconHash />, on: true },
  { id: "approve",  name: "Doc approved",          desc: "Sent when a doc is approved and becomes ground truth",    channel: "#doc-review",   icon: <IconHash />, on: true },
  { id: "changes",  name: "Changes requested",     desc: "Sent when a reviewer asks an agent to revise a doc",      channel: "#doc-review",   icon: <IconHash />, on: true },
  { id: "stale",    name: "Doc went stale",        desc: "Daily digest of docs crossing the 90-day threshold",      channel: "#aqli-hygiene", icon: <IconHash />, on: true },
  { id: "agent",    name: "Agent submitted draft", desc: "Real-time: an agent created a new Draft",                  channel: "—",             icon: <IconSlash />, on: false },
  { id: "mention",  name: "@mentions",             desc: "Sent only to the mentioned user (via Slack DM)",          channel: "DM",            icon: <IconLock />, on: true },
];

const Settings_Integrations_Slack = () => (
  <div className="aqli-screen" data-screen-label="24 · Slack · Configure">
    <SettingsSB8 active="integrations" />
    <div className="main">
      <TopBar crumbs={["Settings", "Integrations", "Slack"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
        <BackLink label="All integrations" />

        <SetHead8
          logo={<SlackLogo2 size={48} />}
          title="Slack"
          status={<ConnectedChip to="tabadulat" />}
          sub="Aqli posts to Slack so the review loop never disappears into the app. Map each event type to a channel, or mute it entirely."
          action={<button className="btn btn-secondary" style={{ color: "#993C1D" }}>Disconnect</button>}
        />

        <Card8 title="Connection"
          sub="The Slack workspace this Aqli workspace posts to.">
          <div style={{
            display: "grid", gridTemplateColumns: "44px 1fr auto",
            gap: 14, alignItems: "center",
            padding: "12px 14px",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 8,
              background: "#3F0F3F", color: "#fff",
              fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 16,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>T</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                Tabadulat
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                tabadulat.slack.com · connected by Sara · Apr 18
              </span>
            </div>
            <button className="btn btn-secondary">Re-authorize</button>
          </div>
        </Card8>

        <Card8 title="Event routing"
          sub="One channel per event type. Use DMs for personal notifications like @mentions.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SLACK_EVENTS.map((e) => <SlackEventRow key={e.id} e={e} />)}
          </div>
        </Card8>

        <Card8 title="Posting style">
          <Toggle8 label="Rich previews with doc title + status badge" desc="Falls back to plain links if Slack blocks rich unfurls." on />
          <Toggle8 label="Include AI summary in review-request posts" desc="One-paragraph TL;DR so reviewers can triage from Slack." on />
          <Toggle8 label="Threaded replies for follow-ups" desc="Approve / Request changes events thread under the original review request." />
        </Card8>

        <Card8 title="Mute hours"
          sub="Aqli holds non-urgent posts until your workspace is back online.">
          <div style={{ display: "flex", gap: 10 }}>
            <Picker8 label="Quiet from" value="19:00" />
            <Picker8 label="Until" value="08:00" />
            <Picker8 label="Timezone" value="Asia/Dubai · GST" wide />
          </div>
        </Card8>
      </div>
    </div>
  </div>
);

const SlackEventRow = ({ e }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "1fr 240px 40px",
    gap: 14, alignItems: "center",
    padding: "12px 14px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    opacity: e.on ? 1 : 0.55,
  }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{e.name}</span>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{e.desc}</span>
    </div>
    <ChannelSelect channel={e.channel} icon={e.icon} muted={!e.on} />
    <span style={{
      width: 32, height: 18, borderRadius: 999,
      background: e.on ? "var(--accent)" : "var(--border-strong)",
      position: "relative", justifySelf: "end",
    }}>
      <span style={{
        position: "absolute", top: 2, left: e.on ? 16 : 2,
        width: 14, height: 14, borderRadius: 999,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }} />
    </span>
  </div>
);

const ChannelSelect = ({ channel, icon, muted }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    height: 32, padding: "0 10px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 12.5,
    color: muted ? "var(--text-muted)" : "var(--text-primary)",
    fontFamily: "var(--font-mono)",
  }}>
    <span style={{ color: muted ? "var(--text-muted)" : "var(--text-secondary)", display: "flex" }}>
      {React.cloneElement(icon, { size: 13 })}
    </span>
    <span style={{ flex: 1 }}>{channel}</span>
    <IconChevDown size={12} />
  </div>
);

const Picker8 = ({ label, value, wide }) => (
  <div style={{ flex: wide ? 2 : 1, display: "flex", flexDirection: "column", gap: 5 }}>
    <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
    <div style={{
      display: "flex", alignItems: "center",
      height: 34, padding: "0 12px",
      background: "var(--bg-base)",
      border: "1px solid var(--border)",
      borderRadius: 6,
      fontSize: 13, color: "var(--text-primary)",
      fontFamily: "var(--font-mono)",
    }}>
      <span style={{ flex: 1 }}>{value}</span>
      <IconChevDown size={12} />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// 25 · GITHUB configure
// ─────────────────────────────────────────────────────────────────────
const GH_REPOS = [
  { code: "tabadulat/aqli-mirror",  name: "aqli-mirror",          spaces: "All spaces",                   branch: "main",      visibility: "private", on: true, primary: true },
  { code: "tabadulat/runbooks",     name: "runbooks",             spaces: "Engineering only",             branch: "main",      visibility: "private", on: true },
  { code: "tabadulat/policies",     name: "policies",             spaces: "Trust & Safety only",          branch: "main",      visibility: "private", on: false },
  { code: "tabadulat/web",          name: "web",                  spaces: "Not synced",                   branch: "—",         visibility: "private", on: false },
];

const Settings_Integrations_GitHub = () => (
  <div className="aqli-screen" data-screen-label="25 · GitHub · Configure">
    <SettingsSB8 active="integrations" />
    <div className="main">
      <TopBar crumbs={["Settings", "Integrations", "GitHub"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
        <BackLink label="All integrations" />

        <SetHead8
          logo={<GitHubLogo2 size={48} />}
          title="GitHub"
          status={<ConnectedChip to="tabadulat" />}
          sub="Mirror approved docs to a Git repo as Markdown. Useful for engineering teams that want a Git-native copy of the knowledge base or for CI to read."
          action={<button className="btn btn-secondary" style={{ color: "#993C1D" }}>Disconnect</button>}
        />

        <Card8 title="Mirror behaviour"
          sub="What Aqli does when a doc reaches certain states.">
          <Toggle8 label="Commit on Approved" desc="When a doc moves to Approved, commit the latest version to the linked repo." on />
          <Toggle8 label="Open PR for In Review docs" desc="Pushes a branch + draft PR so engineers can review in their existing flow." on />
          <Toggle8 label="Mirror agent-authored docs only" desc="Skip human-written docs (keep them Aqli-only).  Useful if humans use Aqli as a draft layer." />
          <Toggle8 label="Include Aqli metadata as frontmatter" desc="YAML frontmatter with status, owner, reviewers, agent attribution." on />
        </Card8>

        <Card8 title="Repositories"
          sub="One primary repo for everything, or one per space. The primary repo holds workspace-wide docs.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {GH_REPOS.map((r, i) => <RepoRow key={i} r={r} />)}
          </div>
          <button style={{
            marginTop: 8,
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 12px", borderRadius: 6,
            background: "var(--bg-base)",
            border: "1px dashed var(--border-strong)",
            color: "var(--text-secondary)", fontSize: 13, fontWeight: 500,
            cursor: "pointer",
            width: "fit-content",
          }}>
            <IconPlus size={13} sw={2} />
            Map another repo
          </button>
        </Card8>

        <Card8 title="Commit identity"
          sub="GitHub user the commits show up under. Use a bot account in production.">
          <div style={{
            display: "grid", gridTemplateColumns: "44px 1fr auto",
            gap: 14, alignItems: "center",
            padding: "12px 14px",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 999,
              background: "#1A1A18", color: "#fff",
              fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>AQ</span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
                aqli-bot
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                bot@aqli.app · GitHub App
              </span>
            </div>
            <button className="btn btn-secondary">Change</button>
          </div>
        </Card8>
      </div>
    </div>
  </div>
);

const RepoRow = ({ r }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "40px 1fr 100px 110px 110px 36px",
    gap: 14, alignItems: "center",
    padding: "12px 14px",
    background: "var(--bg-base)",
    border: `1px solid ${r.primary ? "rgba(15,110,86,0.25)" : "var(--border)"}`,
    boxShadow: r.primary ? "0 0 0 2px rgba(15,110,86,0.05)" : "none",
    borderRadius: 8,
  }}>
    <span style={{
      width: 30, height: 30, borderRadius: 6,
      background: "#1A1A18", color: "#fff",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <GitHubLogo2 size={20} />
    </span>
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
          {r.code}
        </span>
        {r.primary && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "1px 6px", borderRadius: 3,
            background: "var(--accent)", color: "#fff",
          }}>
            Primary
          </span>
        )}
      </div>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        {r.spaces}
      </span>
    </div>
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 12,
      color: r.on ? "var(--text-secondary)" : "var(--text-muted)",
    }}>
      {r.branch}
    </span>
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11.5, color: "var(--text-muted)",
    }}>
      <IconLock size={11} />
      {r.visibility}
    </span>
    <span style={{ fontSize: 11.5, color: r.on ? "var(--approved-text)" : "var(--text-muted)" }}>
      {r.on ? "Mirroring" : "Available"}
    </span>
    <span style={{
      width: 32, height: 18, borderRadius: 999,
      background: r.on ? "var(--accent)" : "var(--border-strong)",
      position: "relative", justifySelf: "end",
    }}>
      <span style={{
        position: "absolute", top: 2, left: r.on ? 16 : 2,
        width: 14, height: 14, borderRadius: 999,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }} />
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// 26 · NOTIFICATION SETTINGS PAGE
// ─────────────────────────────────────────────────────────────────────

const NotifMatrixRow = ({ label, desc, channels }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "1fr 88px 88px 88px",
    gap: 14, alignItems: "center",
    padding: "14px 0",
    borderTop: "1px solid var(--border)",
  }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
      <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>{desc}</span>
    </div>
    {channels.map((c, i) => <ChannelDot key={i} state={c} />)}
  </div>
);

const ChannelDot = ({ state }) => {
  // state: 'on' | 'off' | 'na'
  if (state === "na") {
    return (
      <span style={{
        justifySelf: "center",
        width: 28, height: 28, borderRadius: 6,
        background: "var(--bg-sidebar)",
        color: "var(--text-muted)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: "1px solid var(--border)",
        fontSize: 11,
      }}>—</span>
    );
  }
  const on = state === "on";
  return (
    <span style={{
      justifySelf: "center",
      width: 32, height: 18, borderRadius: 999,
      background: on ? "var(--accent)" : "var(--border-strong)",
      position: "relative", display: "inline-block",
    }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 16 : 2,
        width: 14, height: 14, borderRadius: 999,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      }} />
    </span>
  );
};

const Settings_Notifications = () => (
  <div className="aqli-screen" style={{ height: 1100 }} data-screen-label="26 · Settings · Notifications">
    <SettingsSB8 active="notifications" />
    <div className="main">
      <TopBar crumbs={["Settings", "Notifications"]} primary={null} showShare={false} />
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
              Notifications
            </h1>
            <p style={{ margin: 0, maxWidth: 640, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
              How Aqli reaches you when something changes. These are your personal preferences — workspace admins set the defaults, you can override per channel.
            </p>
          </div>
          <button className="btn btn-secondary">Reset to defaults</button>
        </header>

        {/* Quiet hours card */}
        <Card8 title="Quiet hours"
          sub="Aqli holds non-urgent notifications until you're back. Urgent (review requests on docs you own) still come through.">
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "14px 16px",
            background: "var(--accent-light)",
            border: "1px solid rgba(15,110,86,0.25)",
            borderRadius: 8,
          }}>
            <span style={{
              width: 32, height: 18, borderRadius: 999,
              background: "var(--accent)", position: "relative",
            }}>
              <span style={{
                position: "absolute", top: 2, left: 16,
                width: 14, height: 14, borderRadius: 999,
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              }} />
            </span>
            <span style={{ fontSize: 13.5, color: "var(--text-primary)", fontWeight: 500 }}>
              Quiet from
            </span>
            <span style={{
              padding: "4px 10px", borderRadius: 6,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-mono)", fontSize: 12.5,
              color: "var(--text-primary)",
            }}>19:00</span>
            <span style={{ fontSize: 13.5, color: "var(--text-primary)" }}>to</span>
            <span style={{
              padding: "4px 10px", borderRadius: 6,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-mono)", fontSize: 12.5,
              color: "var(--text-primary)",
            }}>08:00</span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 4 }}>
              · Asia/Dubai
            </span>
            <div style={{ flex: 1 }} />
            <span style={{
              fontSize: 11.5, color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}>
              Mon–Fri only
            </span>
          </div>
        </Card8>

        {/* Channel matrix */}
        <Card8 title="What to notify me about"
          sub="Pick the channels for each event. In-app is always available; turn off to silence the bell.">
          {/* Header row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 88px 88px 88px",
            gap: 14, paddingBottom: 8,
            fontSize: 10.5, fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--text-muted)",
          }}>
            <span>Event</span>
            <span style={{ justifySelf: "center", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconBell size={11} /> In-app
            </span>
            <span style={{ justifySelf: "center", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconMail2 size={11} /> Email
            </span>
            <span style={{ justifySelf: "center", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-flex" }}><SlackLogo2 size={14} /></span> Slack
            </span>
          </div>

          <NotifMatrixRow
            label="Review requested on a doc I own"
            desc="Someone (or an agent) wants you to review."
            channels={["on", "on", "on"]}
          />
          <NotifMatrixRow
            label="@Mention in a doc or comment"
            desc="You were pinged directly."
            channels={["on", "on", "on"]}
          />
          <NotifMatrixRow
            label="My doc was approved / changes requested"
            desc="Final decision on a doc you authored."
            channels={["on", "on", "off"]}
          />
          <NotifMatrixRow
            label="Agent submitted a doc in my space"
            desc="An agent posted a Draft in a space you watch."
            channels={["on", "off", "off"]}
          />
          <NotifMatrixRow
            label="A doc I own went stale"
            desc="Crossed your workspace freshness threshold (90 days)."
            channels={["on", "on", "off"]}
          />
          <NotifMatrixRow
            label="Weekly digest"
            desc="Monday morning summary of last week's docs + reviews."
            channels={["off", "on", "off"]}
          />
          <NotifMatrixRow
            label="Comment replies on threads I'm in"
            desc="Someone replied to a thread you commented in."
            channels={["on", "off", "na"]}
          />
        </Card8>

        {/* Mobile / extras */}
        <Card8 title="Other channels">
          <Toggle8 label="Browser push notifications" desc="Real-time alerts even when Aqli isn't focused. Requires permission." />
          <Toggle8 label="Daily digest email" desc="If your inbox is busy, batch into one 18:00 GST summary instead of per-event." />
          <Toggle8 label="Email me a copy of every Slack notification" desc="Useful if you don't always read Slack DMs." />
        </Card8>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// 27 · REVIEW · APPROVE confirm modal
// 28 · REVIEW · REJECT confirm modal
// ─────────────────────────────────────────────────────────────────────

// We re-mount a lightweight version of the Review detail screen behind
// the modal so the confirm sits in context. We don't redraw everything —
// just enough that the scrim feels grounded.

const ReviewBackdrop = () => (
  <div className="aqli-screen" style={{ height: 1100, opacity: 0.5 }}>
    <Sidebar activeNav="review" />
    <div className="main">
      <TopBar crumbs={["Review", "Fix: Payout retry…"]} primary={null} showShare={false} />
      <div style={{
        flex: "0 0 56px", height: 56,
        padding: "0 32px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-base)",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <StatusBadge status="Review" />
        <span style={{ color: "var(--border-strong)" }}>|</span>
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
          Claude Code
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          · Ali's laptop · submitted 1 hour ago
        </span>
      </div>
      <div style={{ flex: 1, background: "var(--bg-base)", padding: "44px 40px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 400, fontSize: 36,
            lineHeight: 1.1, letterSpacing: "-0.015em",
            margin: 0,
          }}>
            Fix: Payout retry on transient bank failures
          </h1>
        </div>
      </div>
    </div>
  </div>
);

const ScrimP = () => (
  <div style={{
    position: "absolute", inset: 0,
    background: "rgba(20, 20, 18, 0.32)", zIndex: 50,
  }} />
);

const ConfirmModal = ({ tone, title, icon, children, primaryLabel, primaryIcon, primaryTone }) => {
  const tones = {
    success: { bg: "var(--approved-bg)", border: "var(--approved-border)", color: "var(--approved-text)" },
    danger:  { bg: "var(--stale-bg)",    border: "var(--stale-border)",    color: "var(--stale-text)" },
  };
  const t = tones[tone];
  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: 540,
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      boxShadow: "0 18px 48px -12px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.06)",
      zIndex: 51,
      overflow: "hidden",
    }}>
      {/* Tone strip */}
      <div style={{
        padding: "18px 26px",
        background: t.bg,
        borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{
          width: 32, height: 32, borderRadius: 8,
          background: "var(--bg-card)",
          color: t.color,
          border: `1px solid ${t.border}`,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </span>
        <h2 style={{
          margin: 0, fontFamily: "var(--font-serif)",
          fontWeight: 400, fontSize: 22,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
        }}>
          {title}
        </h2>
      </div>

      <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
        {children}
      </div>

      {/* Footer */}
      <div style={{
        padding: "14px 26px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-base)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          This decision is recorded in the doc's version history.
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost">Cancel</button>
          <button
            className={primaryTone === "danger" ? "btn btn-danger" : "btn btn-primary"}
            style={primaryTone === "danger" ? {
              background: "#993C1D",
              borderColor: "#993C1D",
              color: "#fff",
            } : undefined}
          >
            {primaryIcon}
            <span>{primaryLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoLine = ({ label, value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <span style={{
      fontSize: 11, fontWeight: 600,
      letterSpacing: "0.1em", textTransform: "uppercase",
      color: "var(--text-muted)",
      width: 88, flex: "0 0 88px",
    }}>{label}</span>
    <span style={{ fontSize: 13.5, color: "var(--text-primary)" }}>{value}</span>
  </div>
);

const ReviewDetail_Approve = () => (
  <div style={{ position: "relative" }} data-screen-label="27 · Review · Approve">
    <ReviewBackdrop />
    <ScrimP />
    <ConfirmModal
      tone="success"
      title="Approve this doc?"
      icon={<IconCheck size={17} sw={2.2} />}
      primaryLabel="Approve and publish"
      primaryIcon={<IconCheck size={13} sw={2.2} />}
    >
      <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        Approving promotes <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>v4</strong> to ground truth. From now on, agents will treat this doc as authoritative when answering questions in <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Engineering</strong>.
      </p>

      <div style={{
        background: "var(--bg-sidebar)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <InfoLine label="Doc"      value="Fix: Payout retry on transient bank failures" />
        <InfoLine label="Author"   value={<><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 16, height: 16, borderRadius: 4,
            background: "var(--agent-tint)", border: "1px solid var(--agent-border)",
            color: "var(--agent-icon)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}><IconRobot size={10} /></span>
          Claude Code · Ali's laptop
        </span></>} />
        <InfoLine label="Version"  value={<span style={{ fontFamily: "var(--font-mono)" }}>v3 → v4 · +8/−2 lines</span>} />
        <InfoLine label="Reviewers" value="Ali (you), Sara" />
      </div>

      {/* Note field */}
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
          Note (optional)
        </span>
        <div style={{
          minHeight: 72,
          padding: "10px 12px",
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 13.5, color: "var(--text-primary)",
          lineHeight: 1.55,
        }}>
          Good catch on the jitter window. Approved — let's land this and add the same retry policy to the refund pipeline as a follow-up.
        </div>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          Posted to the doc's activity feed and the agent's context.
        </span>
      </label>

      {/* Follow-on actions */}
      <div style={{
        padding: "12px 14px",
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: 4,
          background: "var(--accent)", color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <IconCheck size={11} sw={2.4} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
            Mirror to GitHub on approve
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
            Commits <code style={{ fontFamily: "var(--font-mono)" }}>engineering/fix-payout-retry.md</code> to{" "}
            <code style={{ fontFamily: "var(--font-mono)" }}>tabadulat/aqli-mirror</code>.
          </div>
        </div>
      </div>
    </ConfirmModal>
  </div>
);

const ReviewDetail_Reject = () => (
  <div style={{ position: "relative" }} data-screen-label="28 · Review · Reject">
    <ReviewBackdrop />
    <ScrimP />
    <ConfirmModal
      tone="danger"
      title="Reject this doc?"
      icon={<IconX2 size={16} />}
      primaryLabel="Reject and archive"
      primaryIcon={<IconX2 size={13} />}
      primaryTone="danger"
    >
      <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        Rejecting closes this doc permanently. The agent won't auto-resubmit, and agents will not use any content from it when answering questions.{" "}
        <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Use Request changes</strong> if you want a revision instead.
      </p>

      <div style={{
        background: "var(--stale-bg)",
        border: "1px solid var(--stale-border)",
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <span style={{ color: "var(--stale-text)", display: "flex", marginTop: 2 }}>
          <IconWarn2 size={15} />
        </span>
        <div style={{ fontSize: 12.5, color: "var(--stale-text)", lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 600 }}>This is destructive.</strong> Rejected docs stay in the archive for audit but are excluded from agent context and search. To revisit later, an admin must restore from the archive.
        </div>
      </div>

      {/* Reason field */}
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
          Reason <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(required)</span>
        </span>
        <div style={{
          padding: "10px 12px",
          background: "var(--bg-base)",
          border: "1px solid #993C1D",
          boxShadow: "0 0 0 3px rgba(153,60,29,0.12)",
          borderRadius: 6,
          fontSize: 13.5, color: "var(--text-primary)",
          lineHeight: 1.55,
        }}>
          Wrong scope — this duplicates work in the existing Bank API Runbook §3.2 and the fix has already shipped. Closing to avoid two sources of truth.
        </div>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          Shown to the agent and stored in the doc's history.
        </span>
      </label>

      <label style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px",
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        cursor: "pointer",
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: 4,
          background: "transparent",
          border: "1.5px solid var(--border-strong)",
        }} />
        <span style={{ flex: 1 }}>
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
            Also disable this agent's write scope
          </span>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", display: "block", marginTop: 2 }}>
            If you're rejecting because the agent shouldn't have written here at all.
          </span>
        </span>
      </label>
    </ConfirmModal>
  </div>
);

Object.assign(window, {
  Settings_Integrations_Slack,
  Settings_Integrations_GitHub,
  Settings_Notifications,
  ReviewDetail_Approve,
  ReviewDetail_Reject,
});

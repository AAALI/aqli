/* global React */
// Aqli — Shared components

// ── Icons (16px stroke) ──────────────────────────────────────────────
const Ic = ({ d, size = 16, sw = 1.6, fill = "none", style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
  >
    {d}
  </svg>
);

const IconHome = (p) => (
  <Ic {...p} d={<><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10.5V20h14v-9.5" /><path d="M10 20v-5h4v5" /></>} />
);
const IconSearch = (p) => (
  <Ic {...p} d={<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.5-3.5" /></>} />
);
const IconBell = (p) => (
  <Ic {...p} d={<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>} />
);
const IconPlus = (p) => (
  <Ic {...p} d={<><path d="M12 5v14M5 12h14" /></>} sw={1.8} />
);
const IconGear = (p) => (
  <Ic {...p} d={<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>} />
);
const IconShare = (p) => (
  <Ic {...p} d={<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.7 7.6-4.4M8.2 13.3l7.6 4.4" /></>} />
);
const IconLink = (p) => (
  <Ic {...p} d={<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 7" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.5-1.5" /></>} />
);
const IconChevDown = (p) => (
  <Ic {...p} d={<path d="m6 9 6 6 6-6" />} />
);
const IconChevRight = (p) => (
  <Ic {...p} d={<path d="m9 6 6 6-6 6" />} />
);
const IconDots = (p) => (
  <Ic {...p} d={<><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" /></>} />
);
const IconSparkle = (p) => (
  <Ic {...p} d={<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></>} sw={1.4} />
);
const IconRobot = (p) => (
  <Ic {...p} d={<><rect x="4" y="8" width="16" height="11" rx="2.5" /><path d="M12 4v4" /><circle cx="12" cy="3.5" r="1" fill="currentColor" /><circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" /><circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" /><path d="M9.5 16h5" /><path d="M2 13v2M22 13v2" /></>} />
);
const IconCheck = (p) => (
  <Ic {...p} d={<path d="m5 12 5 5 9-11" />} sw={2} />
);
const IconArrowUpRight = (p) => (
  <Ic {...p} d={<><path d="M7 17 17 7" /><path d="M9 7h8v8" /></>} sw={1.7} />
);
const IconBook = (p) => (
  <Ic {...p} d={<><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5V4.5Z" /><path d="M4 17.5A1.5 1.5 0 0 1 5.5 16H20" /></>} />
);
const IconKey = (p) => (
  <Ic {...p} d={<><circle cx="8" cy="14" r="4" /><path d="m11 11 9-9" /><path d="m17 5 2 2" /><path d="m14 8 2 2" /></>} />
);
const IconFile = (p) => (
  <Ic {...p} d={<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 16h6M9 10h3" /></>} />
);
const IconFolder = (p) => (
  <Ic {...p} d={<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />} />
);

// ── Aqli logo (geometric Ayn ع abstraction) ───────────────────────────
const AqliMark = ({ size = 20, color = "var(--accent)" }) => (
  // Two curved arcs meeting at a point — stylised teardrop / eye
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Aqli">
    <path
      d="M5 14.5C5 9 9 5 13 5c3.5 0 5.8 2.3 5.8 5.2 0 2.6-1.8 4.5-4.3 4.5-1.7 0-2.9-1-2.9-2.5 0-1.4 1-2.4 2.2-2.4.5 0 .9.1 1.2.3"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="6.4" cy="17.6" r="1.5" fill={color} />
  </svg>
);

const AqliWordmark = ({ size = 20 }) => (
  <div className="sb-brand">
    <AqliMark size={size} />
    <span className="sb-brand-word">aqli</span>
  </div>
);

// ── Sidebar ───────────────────────────────────────────────────────────
const SPACES = [
  { id: "product", emoji: "📋", name: "Product" },
  { id: "engineering", emoji: "⚙️", name: "Engineering" },
  { id: "compliance", emoji: "🛡️", name: "Compliance" },
  { id: "ops", emoji: "🔧", name: "Ops" },
  { id: "company", emoji: "🏢", name: "Company" },
];

const Sidebar = ({ activeNav = null, activeSpace = null, userName = "Ali Al-Mansoori", userInitial = "A" }) => (
  <aside className="sb">
    <div className="sb-head">
      <AqliWordmark />
      <div className="sb-workspace">Airbnb · Workspace</div>
    </div>
    <div className="sb-nav">
      <div className={`sb-item ${activeNav === "home" ? "is-active" : ""}`}>
        <span className="sb-icon"><IconHome /></span>
        <span>Home</span>
      </div>
      <div className={`sb-item ${activeNav === "search" ? "is-active" : ""}`}>
        <span className="sb-icon"><IconSearch /></span>
        <span>Search</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>⌘K</span>
      </div>
      <div className={`sb-item ${activeNav === "review" ? "is-active" : ""}`}>
        <span className="sb-icon"><IconCheck /></span>
        <span>Review Queue</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--review-text)", background: "var(--review-bg)", border: "1px solid var(--review-border)", padding: "0 6px", borderRadius: 999, lineHeight: "16px", height: 16 }}>3</span>
      </div>
    </div>
    <div className="sb-section-label">Spaces</div>
    <div className="sb-nav" style={{ paddingTop: 0 }}>
      {SPACES.map((s) => (
        <div key={s.id} className={`sb-item ${activeSpace === s.id ? "is-active" : ""}`}>
          <span className="sb-emoji">{s.emoji}</span>
          <span>{s.name}</span>
        </div>
      ))}
      <div className="sb-newspace">
        <span className="sb-icon"><IconPlus size={14} /></span>
        <span>New Space</span>
      </div>
    </div>
    <div className="sb-foot">
      <div className="avatar avatar-ali">{userInitial}</div>
      <div className="meta">
        <span className="n">{userName}</span>
        <span className="w">aqli.app/airbnb</span>
      </div>
      <span className="gear"><IconGear size={15} /></span>
    </div>
  </aside>
);

// ── Top bar ───────────────────────────────────────────────────────────
const TopBar = ({ crumbs = [], saved = null, primary = "New Doc", showShare = false, userInitial = "A", notify = true }) => (
  <div className="tb">
    <div className="tb-crumb">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="crumb-sep"><IconChevRight size={12} /></span>}
          <span className={i === crumbs.length - 1 ? "crumb-cur" : ""}>{c}</span>
        </React.Fragment>
      ))}
      {saved && (
        <span className="crumb-saved">
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent)" }}></span>
          {saved}
        </span>
      )}
    </div>
    <div className="tb-spacer"></div>
    <div className="tb-actions">
      {showShare && <button className="btn btn-secondary">Share</button>}
      {primary && (
        <button className="btn btn-primary">
          <IconPlus size={14} />
          {primary}
        </button>
      )}
      <span className="iconbtn">
        <IconBell size={17} />
        {notify && <span className="dot"></span>}
      </span>
      <div className="avatar avatar-sm avatar-ali">{userInitial}</div>
    </div>
  </div>
);

// ── Status badge ──────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Draft: "badge-draft",
    Review: "badge-review",
    Approved: "badge-approved",
    Stale: "badge-stale",
    Archived: "badge-archived",
  };
  return (
    <span className={`badge ${map[status] || "badge-draft"}`}>
      <span className="dot"></span>
      {status}
    </span>
  );
};

const TypeBadge = ({ type }) => <span className="badge badge-type">{type}</span>;

const AgentChip = ({ label = "Agent" }) => (
  <span className="agent-chip">
    <IconRobot size={12} />
    {label}
  </span>
);

// ── Export ────────────────────────────────────────────────────────────
Object.assign(window, {
  Ic,
  IconHome, IconSearch, IconBell, IconPlus, IconGear, IconShare,
  IconLink, IconChevDown, IconChevRight, IconDots, IconSparkle,
  IconRobot, IconCheck, IconArrowUpRight, IconBook, IconKey,
  IconFile, IconFolder,
  AqliMark, AqliWordmark,
  Sidebar, TopBar,
  StatusBadge, TypeBadge, AgentChip,
});

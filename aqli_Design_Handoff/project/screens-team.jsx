// Aqli — Sign in + Invite + Members + Spaces (Batch 4)
// Closes J·02 (returning user), J·03 (invited teammate),
// J·10 (invite teammates), J·11 (add a space).

const { Sidebar, TopBar, AqliMark, AqliWordmark,
  IconHome, IconKey, IconRobot, IconPlus, IconChevDown, IconDots,
  IconCheck, IconArrowUpRight, IconFile, IconBook, IconClose,
  IconBell, IconSparkle } = window;

const Ic5 = ({ d, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IconMail = (p) => (
  <Ic5 {...p} d={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>} />
);
const IconUsers2 = (p) => (
  <Ic5 {...p} d={<><circle cx="9" cy="9" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M21 19a4.5 4.5 0 0 0-5-3.9" /></>} />
);
const IconEye = (p) => (
  <Ic5 {...p} d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>} />
);

// ─────────────────────────────────────────────────────────────────────
// AUTH STAGE (shared between Sign in + Invite)
// ─────────────────────────────────────────────────────────────────────

const AuthStage = ({ children, ornament }) => (
  <div
    style={{
      width: 1440, height: 900,
      display: "grid",
      gridTemplateColumns: "560px 1fr",
      background: "var(--bg-base)",
      fontFamily: "var(--font-sans)",
    }}
  >
    {/* Left brand rail */}
    <div style={{
      background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border)",
      padding: "44px 48px",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AqliMark size={22} />
        <span style={{
          fontSize: 17, letterSpacing: "0.08em", fontWeight: 500,
          color: "var(--text-primary)",
        }}>
          AQLI
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        {ornament}
      </div>

      <div style={{
        fontSize: 11.5, color: "var(--text-muted)",
        lineHeight: 1.6,
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <span>Open source · MIT</span>
        <span>aqli.app · docs.aqli.app</span>
      </div>
    </div>

    {/* Right form */}
    <div style={{
      padding: "44px 64px",
      display: "flex", flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {children}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN A — Sign in (J·02)
// ─────────────────────────────────────────────────────────────────────

const SignIn = () => (
  <div data-screen-label="14 · Sign in">
    <AuthStage
      ornament={
        <>
          <div style={{
            fontSize: 11, fontWeight: 600,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--text-muted)",
          }}>
            Welcome back
          </div>
          <h2 style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 400, fontSize: 38,
            lineHeight: 1.1, letterSpacing: "-0.015em",
            color: "var(--text-primary)",
            textWrap: "balance",
          }}>
            The shared context layer for your team and its agents.
          </h2>
          <p style={{
            margin: 0, fontSize: 14, color: "var(--text-secondary)",
            lineHeight: 1.6, maxWidth: 380,
          }}>
            Sign in to pick up where you left off. Drafts, review queues, and agent activity are all where you left them.
          </p>

          {/* tiny "last activity" chip — gives the page weight */}
          <div style={{
            marginTop: 6,
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 999,
            fontSize: 12, color: "var(--text-secondary)",
            width: "fit-content",
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: 999,
              background: "var(--accent)",
            }} />
            <span>3 docs awaiting your review in Tabadulat</span>
          </div>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 400, fontSize: 28,
            letterSpacing: "-0.015em",
          }}>
            Sign in
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>
            Use your workspace email.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AuthField label="Email">
            <AuthInput value="ali@tabadulat.com" icon={<IconMail size={14} />} />
          </AuthField>

          <AuthField label="Password" trailing={
            <a style={{ fontSize: 11.5, color: "var(--accent)", fontWeight: 500, cursor: "pointer" }}>
              Forgot?
            </a>
          }>
            <AuthInput value="••••••••••••••" focused mono trailing={<IconEye size={14} />} />
          </AuthField>

          <button className="btn btn-primary" style={{
            width: "100%", height: 40, justifyContent: "center", marginTop: 6,
          }}>
            Sign in
          </button>
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          fontSize: 12, color: "var(--text-muted)",
        }}>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span>or</span>
          <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <button style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          width: "100%", height: 40, padding: "0 14px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 13.5, fontWeight: 500,
          color: "var(--text-primary)", cursor: "pointer",
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 4,
            background: "#1f1f1d", color: "#fff",
            fontSize: 10, fontWeight: 700,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            ⌥
          </span>
          <span>Continue with SSO</span>
        </button>

        <div style={{
          fontSize: 12.5, color: "var(--text-secondary)", textAlign: "center",
        }}>
          New here?{" "}
          <a style={{ color: "var(--accent)", fontWeight: 500, cursor: "pointer" }}>
            Create a workspace
          </a>
        </div>
      </div>
    </AuthStage>
  </div>
);

// ── Auth primitives ──────────────────────────────────────────────────
const AuthField = ({ label, trailing, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
      {trailing}
    </div>
    {children}
  </label>
);

const AuthInput = ({ value, icon, trailing, focused, mono }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    height: 40, padding: "0 12px",
    background: "var(--bg-card)",
    border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
    boxShadow: focused ? "0 0 0 3px rgba(15,110,86,0.12)" : "none",
    borderRadius: 8,
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: mono ? 13 : 14,
    color: "var(--text-primary)",
  }}>
    {icon && <span style={{ color: "var(--text-muted)", display: "flex" }}>{icon}</span>}
    <span style={{ flex: 1, letterSpacing: mono ? "0.04em" : 0 }}>{value}</span>
    {focused && (
      <span style={{
        width: 1.5, height: 16, background: "var(--accent)",
        marginRight: trailing ? 6 : 0,
        animation: "aqli-blink 1.05s steps(1) infinite",
      }} />
    )}
    {trailing && (
      <span style={{ color: "var(--text-muted)", display: "flex", cursor: "pointer" }}>
        {trailing}
      </span>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN B — Invite landing (J·03)
// ─────────────────────────────────────────────────────────────────────

const InviteLanding = () => (
  <div data-screen-label="15 · Invite landing">
    <AuthStage
      ornament={
        <>
          <div style={{
            fontSize: 11, fontWeight: 600,
            letterSpacing: "0.14em", textTransform: "uppercase",
            color: "var(--text-muted)",
          }}>
            You've been invited
          </div>

          {/* Inviter card */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "16px 18px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            width: "fit-content",
          }}>
            <span className="avatar avatar-lg avatar-ali" style={{ width: 44, height: 44, fontSize: 16 }}>A</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
                <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>Ali Al-Mansoori</strong> invited you to
              </span>
              <span style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22, fontWeight: 400,
                letterSpacing: "-0.015em",
                color: "var(--text-primary)",
              }}>
                Tabadulat
              </span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                tabadulat.aqli.app · 4 spaces · 38 docs
              </span>
            </div>
          </div>

          {/* What you'll get */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--text-muted)",
            }}>
              Your role: <span style={{ color: "var(--accent)" }}>Editor</span>
            </div>
            <PermBullet text="Read and write docs in every Space" />
            <PermBullet text="Comment on, approve, or request changes to any doc" />
            <PermBullet text="Use the AI search and Ask features" />
            <PermBullet text="Cannot manage members or API keys (Admin only)" muted />
          </div>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 400, fontSize: 28,
            letterSpacing: "-0.015em",
          }}>
            Join Tabadulat
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)" }}>
            Set a password to finish your account. Takes 10 seconds.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AuthField label="Full name">
            <AuthInput value="Khalid Rashid" />
          </AuthField>

          <AuthField label="Email">
            <AuthInput value="khalid@tabadulat.com" icon={<IconMail size={14} />} />
          </AuthField>

          <AuthField label="Password" trailing={
            <span style={{ fontSize: 11, color: "var(--approved-text)", fontWeight: 500 }}>
              Strong
            </span>
          }>
            <AuthInput value="••••••••••••••••" focused mono trailing={<IconEye size={14} />} />
          </AuthField>

          <button className="btn btn-primary" style={{
            width: "100%", height: 40, justifyContent: "center", marginTop: 6, gap: 6,
          }}>
            <span>Join Tabadulat</span>
            <IconArrowUpRight size={13} sw={1.8} />
          </button>
        </div>

        <div style={{
          padding: "10px 12px",
          background: "var(--bg-sidebar)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 11.5, color: "var(--text-muted)",
          lineHeight: 1.5,
        }}>
          By joining, you agree that the workspace admin can see your activity (docs you write, comments you leave). Your password is stored hashed; Aqli admins cannot see it.
        </div>
      </div>
    </AuthStage>
  </div>
);

const PermBullet = ({ text, muted }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    fontSize: 13, color: muted ? "var(--text-muted)" : "var(--text-primary)",
    opacity: muted ? 0.7 : 1,
  }}>
    <span style={{
      width: 18, height: 18, borderRadius: 999,
      background: muted ? "var(--bg-card)" : "var(--accent-light)",
      color: muted ? "var(--text-muted)" : "var(--accent)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: `1px solid ${muted ? "var(--border)" : "rgba(15,110,86,0.2)"}`,
    }}>
      {muted ? <IconClose size={10} sw={2} /> : <IconCheck size={11} sw={2.4} />}
    </span>
    <span>{text}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN C — Settings · Members + Invite dialog (J·10)
// ─────────────────────────────────────────────────────────────────────

const MEMBERS = [
  { name: "Ali Al-Mansoori", initial: "A", cls: "avatar-ali", email: "ali@tabadulat.com", role: "Admin", state: "Active", lastSeen: "Just now", you: true },
  { name: "Sara Hassan", initial: "S", cls: "avatar-sara", email: "sara@tabadulat.com", role: "Editor", state: "Active", lastSeen: "2 hours ago" },
  { name: "Khalid Rashid", initial: "K", cls: "avatar-khalid", email: "khalid@tabadulat.com", role: "Editor", state: "Active", lastSeen: "5 days ago" },
  { name: "—", initial: "L", cls: "avatar-khalid", email: "leyla@tabadulat.com", role: "Editor", state: "Pending", lastSeen: "Invited 2d ago — not accepted" },
];

const SettingsSidebar2 = ({ active = "members" }) => {
  const Gear = window.IconGear, Key = window.IconKey, Robot = window.IconRobot;
  const nav = [
    { id: "general", icon: <Gear />, label: "Workspace" },
    { id: "members", icon: <IconUsers2 />, label: "Members", count: 4 },
    { id: "keys", icon: <Key />, label: "API keys", count: 3 },
    { id: "integrations", icon: <Robot />, label: "Integrations" },
    { id: "agents", icon: <Robot />, label: "Agent activity" },
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
          <span style={{ display: "inline-flex" }}>←</span>
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

const Settings_Members = () => (
  <div className="aqli-screen" data-screen-label="16 · Settings · Members + Invite"
    style={{ position: "relative" }}>
    <SettingsSidebar2 active="members" />
    <div className="main">
      <TopBar crumbs={["Settings", "Members"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
        <SettingsHeader2
          title="Members"
          sub="Anyone with a Tabadulat account can read, write, and review docs. Admins can manage workspace settings, members, and API keys."
          action={
            <button className="btn btn-primary">
              <IconPlus size={14} sw={2} />
              <span>Invite member</span>
            </button>
          }
        />

        {/* Role pills */}
        <div className="fpills" style={{ marginBottom: 18 }}>
          <button className="fpill is-active">All · 4</button>
          <button className="fpill">Admins · 1</button>
          <button className="fpill">Editors · 3</button>
          <button className="fpill">Viewers · 0</button>
          <button className="fpill">Pending · 1</button>
        </div>

        {/* Members table */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          overflow: "hidden",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 220px 120px 200px 32px",
            gap: 16, padding: "12px 20px",
            background: "var(--bg-sidebar)",
            borderBottom: "1px solid var(--border)",
            fontSize: 10.5, fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--text-muted)",
          }}>
            <span>Member</span>
            <span>Email</span>
            <span>Role</span>
            <span>Last active</span>
            <span></span>
          </div>
          {MEMBERS.map((m, i) => <MemberRow key={i} m={m} />)}
        </div>
      </div>
    </div>

    {/* Invite dialog overlay */}
    <ScrimC />
    <InviteModal />
  </div>
);

const MemberRow = ({ m }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "1fr 220px 120px 200px 32px",
    gap: 16, alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid var(--border)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span className={`avatar ${m.cls}`} style={{ width: 32, height: 32, fontSize: 12 }}>
        {m.initial}
      </span>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: "var(--text-primary)",
          letterSpacing: "-0.005em",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {m.name === "—" ? <span style={{ color: "var(--text-muted)" }}>(Not yet joined)</span> : m.name}
          {m.you && (
            <span style={{
              fontSize: 10.5, fontWeight: 500, color: "var(--text-muted)",
              padding: "0 6px", borderRadius: 3,
              background: "var(--bg-sidebar)",
            }}>
              you
            </span>
          )}
        </div>
      </div>
    </div>

    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-secondary)" }}>
      {m.email}
    </span>

    <div>
      <RoleChip role={m.role} />
    </div>

    <div style={{ fontSize: 12.5, color: m.state === "Pending" ? "var(--review-text)" : "var(--text-secondary)" }}>
      {m.state === "Pending" && (
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          marginRight: 6,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--review-text)" }} />
          Pending ·
        </span>
      )}
      {m.lastSeen}
    </div>

    <span style={{ color: "var(--text-muted)", justifySelf: "center", cursor: "pointer" }}>
      <IconDots size={16} />
    </span>
  </div>
);

const RoleChip = ({ role }) => {
  const palette = {
    Admin: { bg: "var(--accent-light)", color: "var(--accent)", border: "rgba(15,110,86,0.25)" },
    Editor: { bg: "var(--bg-sidebar)", color: "var(--text-secondary)", border: "var(--border)" },
    Viewer: { bg: "var(--draft-bg)", color: "var(--draft-text)", border: "var(--draft-border)" },
  }[role];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      height: 22, padding: "0 8px", borderRadius: 6,
      background: palette.bg, color: palette.color,
      border: `1px solid ${palette.border}`,
      fontSize: 11.5, fontWeight: 500,
    }}>
      {role}
      <IconChevDown size={11} />
    </span>
  );
};

const SettingsHeader2 = ({ title, sub, action }) => (
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

const ScrimC = () => (
  <div style={{
    position: "absolute", inset: 0,
    background: "rgba(20, 20, 18, 0.32)", zIndex: 50,
  }} />
);

const InviteModal = () => (
  <div style={{
    position: "absolute", top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    width: 520,
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
        Invite to Tabadulat
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        They'll get an email with a link to set a password and join.
      </p>
    </div>

    <AuthField label="Email addresses">
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6,
        padding: "8px 10px",
        background: "var(--bg-base)",
        border: "1px solid var(--accent)",
        boxShadow: "0 0 0 3px rgba(15,110,86,0.12)",
        borderRadius: 8,
        minHeight: 40,
      }}>
        <EmailChip email="leyla@tabadulat.com" />
        <EmailChip email="hassan@tabadulat.com" />
        <span style={{
          fontSize: 13, color: "var(--text-muted)",
          display: "inline-flex", alignItems: "center", padding: "0 4px",
        }}>
          +
        </span>
      </div>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
        Paste multiple emails separated by commas or spaces.
      </span>
    </AuthField>

    <AuthField label="Role">
      <RoleSelect />
    </AuthField>

    <AuthField label="Note (optional)">
      <div style={{
        minHeight: 70,
        padding: "10px 12px",
        background: "var(--bg-base)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 13.5, color: "var(--text-primary)",
        lineHeight: 1.55,
      }}>
        Hey — joining you to our Aqli workspace. Start with the Engineering space.
      </div>
    </AuthField>

    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        2 invites · expire in 7 days
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost">Cancel</button>
        <button className="btn btn-primary">
          <IconMail size={13} />
          <span>Send invites</span>
        </button>
      </div>
    </div>
  </div>
);

const EmailChip = ({ email }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 8px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--text-primary)",
  }}>
    {email}
    <span style={{ color: "var(--text-muted)", marginLeft: 2, cursor: "pointer", display: "flex" }}>
      <IconClose size={10} sw={1.8} />
    </span>
  </span>
);

const RoleSelect = () => {
  const opts = [
    { id: "admin", label: "Admin", desc: "Full access — settings, members, API keys." },
    { id: "editor", label: "Editor", desc: "Read, write, review every doc.", on: true },
    { id: "viewer", label: "Viewer", desc: "Read-only across the workspace." },
  ];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {opts.map((o) => (
        <div key={o.id} style={{
          flex: 1,
          padding: "10px 12px",
          background: o.on ? "var(--accent-light)" : "var(--bg-base)",
          border: `1px solid ${o.on ? "rgba(15,110,86,0.3)" : "var(--border)"}`,
          borderRadius: 8, cursor: "pointer",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 14, height: 14, borderRadius: 999,
              border: `1.5px solid ${o.on ? "var(--accent)" : "var(--border-strong)"}`,
              background: o.on ? "var(--accent)" : "transparent",
              position: "relative",
            }}>
              {o.on && (
                <span style={{
                  position: "absolute", top: 2.5, left: 2.5,
                  width: 6, height: 6, borderRadius: 999, background: "#fff",
                }} />
              )}
            </span>
            <span style={{
              fontSize: 12.5, fontWeight: 500,
              color: o.on ? "var(--accent)" : "var(--text-primary)",
            }}>
              {o.label}
            </span>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
            {o.desc}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// SCREEN D — Create Space dialog (J·11)
// ─────────────────────────────────────────────────────────────────────

const CreateSpaceDialog = () => (
  <div className="aqli-screen" data-screen-label="17 · Create Space"
    style={{ position: "relative" }}>
    <Sidebar activeNav="home" />
    <div className="main" style={{ opacity: 0.5 }}>
      <TopBar crumbs={["Home"]} primary={null} showShare={false} />
      <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Home</div>
      </div>
    </div>

    <ScrimC />
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: 520,
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
          New space in Tabadulat
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Spaces group docs by team or topic. Members and agents can be scoped per space.
        </p>
      </div>

      {/* Live preview row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 14px",
        background: "var(--bg-sidebar)",
        border: "1px solid var(--border)",
        borderRadius: 8,
      }}>
        <span style={{ fontSize: 28, lineHeight: 1, filter: "saturate(0.85)" }}>🛡️</span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>
            Trust & Safety
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            tabadulat.aqli.app/spaces/trust-safety
          </span>
        </div>
      </div>

      <AuthField label="Emoji">
        <EmojiPicker />
      </AuthField>

      <AuthField label="Space name">
        <AuthInput value="Trust & Safety" focused />
      </AuthField>

      <AuthField label="Description (optional)">
        <div style={{
          minHeight: 64,
          padding: "10px 12px",
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          fontSize: 13.5, color: "var(--text-primary)",
          lineHeight: 1.5,
        }}>
          Policies, hold rules, and review playbooks. Owned by the T&S team.
        </div>
      </AuthField>

      <AuthField label="Who can write here">
        <div style={{ display: "flex", gap: 8 }}>
          <ScopeOpt label="Everyone in Tabadulat" on />
          <ScopeOpt label="Specific members…" />
        </div>
      </AuthField>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, paddingTop: 16, borderTop: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          You'll be the owner. Reassign later from space settings.
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost">Cancel</button>
          <button className="btn btn-primary">
            <IconPlus size={13} sw={2} />
            <span>Create space</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);

const EmojiPicker = () => {
  const choices = ["🛡️", "📋", "⚙️", "💼", "📊", "🔬", "💸", "🎨"];
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {choices.map((e, i) => (
        <span key={i} style={{
          width: 36, height: 36, borderRadius: 8,
          background: i === 0 ? "var(--accent-light)" : "var(--bg-base)",
          border: `1px solid ${i === 0 ? "rgba(15,110,86,0.25)" : "var(--border)"}`,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, cursor: "pointer",
          filter: "saturate(0.85)",
        }}>
          {e}
        </span>
      ))}
    </div>
  );
};

const ScopeOpt = ({ label, on }) => (
  <div style={{
    flex: 1,
    padding: "10px 12px",
    background: on ? "var(--accent-light)" : "var(--bg-base)",
    border: `1px solid ${on ? "rgba(15,110,86,0.3)" : "var(--border)"}`,
    borderRadius: 8,
    display: "flex", alignItems: "center", gap: 8,
    cursor: "pointer",
  }}>
    <span style={{
      width: 14, height: 14, borderRadius: 999,
      border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
      background: on ? "var(--accent)" : "transparent",
      position: "relative",
    }}>
      {on && (
        <span style={{
          position: "absolute", top: 2.5, left: 2.5,
          width: 6, height: 6, borderRadius: 999, background: "#fff",
        }} />
      )}
    </span>
    <span style={{
      fontSize: 13, fontWeight: 500,
      color: on ? "var(--accent)" : "var(--text-primary)",
    }}>
      {label}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────
// SCREEN E — Empty Space (J·11 · target)
// ─────────────────────────────────────────────────────────────────────

const EmptySpace = () => (
  <div className="aqli-screen" data-screen-label="18 · Empty Space">
    <Sidebar activeSpace="trust-safety" />
    <div className="main">
      <TopBar crumbs={["Trust & Safety"]} primary="New Doc" showShare={true} />
      <div className="content" style={{ padding: "32px 40px" }}>
        {/* Space header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <span style={{ fontSize: 28, lineHeight: 1, filter: "saturate(0.85)" }}>🛡️</span>
            <h1 style={{
              margin: 0, fontSize: 26, fontWeight: 500,
              letterSpacing: "-0.015em",
            }}>
              Trust & Safety
            </h1>
            <span style={{
              padding: "0 8px", height: 22, borderRadius: 6,
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
              fontSize: 11.5,
              display: "inline-flex", alignItems: "center",
              marginLeft: 4,
            }}>
              Just created
            </span>
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-secondary)", marginLeft: 40 }}>
            Policies, hold rules, and review playbooks. Owned by the T&S team.
          </div>
        </div>

        {/* Empty hero */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px dashed var(--border-strong)",
          borderRadius: 14,
          padding: "44px 36px",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 36,
          alignItems: "center",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              letterSpacing: "0.14em", textTransform: "uppercase",
              color: "var(--text-muted)",
            }}>
              Empty space
            </div>
            <h2 style={{
              margin: 0, fontFamily: "var(--font-serif)",
              fontWeight: 400, fontSize: 32,
              letterSpacing: "-0.015em", lineHeight: 1.1,
              textWrap: "balance",
            }}>
              Write the first doc, or let an agent draft one.
            </h2>
            <p style={{
              margin: 0, fontSize: 14, color: "var(--text-secondary)",
              lineHeight: 1.6, maxWidth: 540,
            }}>
              Trust & Safety is fresh. Pick a doc type to get a template, or point an agent at this space and have it draft a starting compliance summary you can refine.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary">
                <IconPlus size={13} sw={2} />
                <span>New doc</span>
              </button>
              <button className="btn btn-secondary">
                <IconRobot size={13} />
                <span>Let Claude Code draft one</span>
              </button>
            </div>
          </div>

          <div style={{
            display: "flex", flexDirection: "column", gap: 10,
            padding: "18px 18px",
            background: "var(--bg-base)",
            border: "1px solid var(--border)",
            borderRadius: 12,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600,
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--text-muted)", marginBottom: 4,
            }}>
              Suggested templates
            </div>
            <SuggestTile code="POL" name="Compliance policy" />
            <SuggestTile code="DEC" name="Decision log" />
            <SuggestTile code="RUN" name="Review playbook" />
          </div>
        </div>

        {/* Bottom hint */}
        <div style={{
          marginTop: 22,
          padding: "14px 18px",
          background: "var(--bg-sidebar)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          display: "flex", alignItems: "center", gap: 12,
          fontSize: 13, color: "var(--text-secondary)",
        }}>
          <span style={{ color: "var(--accent)", display: "flex" }}>
            <IconSparkle size={14} />
          </span>
          <span>
            Agents can be scoped to this space.{" "}
            <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>
              Settings → API keys → edit scope
            </strong>{" "}
            to point Claude Code or GPT here.
          </span>
        </div>
      </div>
    </div>
  </div>
);

const SuggestTile = ({ code, name }) => (
  <div style={{
    display: "grid", gridTemplateColumns: "32px 1fr 16px",
    gap: 10, alignItems: "center",
    padding: "8px 10px", margin: "0 -10px",
    borderRadius: 6, cursor: "pointer",
  }}>
    <span style={{
      width: 30, height: 30, borderRadius: 5,
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      color: "var(--text-secondary)",
      fontFamily: "var(--font-mono)",
      fontSize: 10, fontWeight: 600,
      letterSpacing: "0.04em",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      {code}
    </span>
    <span style={{ fontSize: 13.5, color: "var(--text-primary)", fontWeight: 500 }}>{name}</span>
    <span style={{ color: "var(--text-muted)", display: "flex" }}>
      <IconArrowUpRight size={12} sw={1.7} />
    </span>
  </div>
);

Object.assign(window, {
  SignIn,
  InviteLanding,
  Settings_Members,
  CreateSpaceDialog,
  EmptySpace,
});

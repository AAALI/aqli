// Aqli — Settings shell + API Keys (Batch 1 · closes J·09)
// Settings replaces the main sidebar with its own sub-nav. The "Add another
// AI agent" flow lives end-to-end here: list → new-key form → one-time reveal.

const { TopBar, AqliMark, IconHome, IconGear, IconKey, IconRobot, IconPlus,
  IconChevRight, IconDots, IconCheck, IconArrowUpRight, IconBell, IconBook,
  IconLink, IconFile, IconFolder, IconChevDown } = window;

// ── Local icons we don't have yet ─────────────────────────────────────
const Ic2 = ({ d, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const IconUsers = (p) => (
  <Ic2 {...p} d={<><circle cx="9" cy="9" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17" cy="9" r="2.5" /><path d="M21 19a4.5 4.5 0 0 0-5-3.9" /></>} />
);
const IconPlug = (p) => (
  <Ic2 {...p} d={<><path d="M9 2v5M15 2v5" /><path d="M6 7h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6V7Z" /><path d="M12 17v5" /></>} />
);
const IconShield = (p) => (
  <Ic2 {...p} d={<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />} />
);
const IconCopy = (p) => (
  <Ic2 {...p} d={<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>} />
);
const IconAlert = (p) => (
  <Ic2 {...p} d={<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v5M12 17.5v.2" /></>} />
);
const IconArrowLeft = (p) => (
  <Ic2 {...p} d={<><path d="M5 12h14" /><path d="m12 5-7 7 7 7" /></>} sw={1.8} />
);
const IconClose = (p) => (
  <Ic2 {...p} d={<><path d="M6 6l12 12M18 6 6 18" /></>} sw={1.8} />
);

// ── Settings sub-sidebar ──────────────────────────────────────────────
const SettingsSidebar = ({ active = "keys" }) => {
  const nav = [
    { id: "general", icon: <IconGear />, label: "Workspace" },
    { id: "members", icon: <IconUsers />, label: "Members", count: 4 },
    { id: "keys", icon: <IconKey />, label: "API keys", count: 3 },
    { id: "integrations", icon: <IconPlug />, label: "Integrations" },
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
          <IconArrowLeft size={14} />
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
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11, color: "var(--text-muted)",
                background: "transparent",
              }}>
                {n.count}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: "0 8px" }}>
        <div className="sb-section-label" style={{ paddingLeft: 10 }}>Danger zone</div>
        <div className="sb-item" style={{ color: "#993C1D" }}>
          <span className="sb-icon" style={{ color: "#993C1D" }}><IconShield /></span>
          <span>Delete workspace</span>
        </div>
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

// ── Settings page header ─────────────────────────────────────────────
const SettingsHeader = ({ title, sub, action }) => (
  <header style={{
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 24,
    paddingBottom: 22,
    borderBottom: "1px solid var(--border)",
    marginBottom: 28,
  }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h1 style={{
        margin: 0,
        fontFamily: "var(--font-serif)",
        fontWeight: 400,
        fontSize: 34,
        letterSpacing: "-0.015em",
        lineHeight: 1.1,
      }}>
        {title}
      </h1>
      {sub && (
        <p style={{
          margin: 0,
          maxWidth: 620,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-secondary)",
        }}>
          {sub}
        </p>
      )}
    </div>
    {action}
  </header>
);

// ── API Key row ──────────────────────────────────────────────────────
const KeyRow = ({ k }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "44px 1fr 140px 180px 28px",
    gap: 16,
    alignItems: "center",
    padding: "18px 20px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
  }}>
    <span style={{
      width: 36, height: 36, borderRadius: 8,
      background: "var(--agent-tint)",
      border: "1px solid var(--agent-border)",
      color: "var(--agent-icon)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <IconRobot size={18} />
    </span>

    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <div style={{
        fontSize: 14.5,
        fontWeight: 500,
        color: "var(--text-primary)",
        letterSpacing: "-0.005em",
      }}>
        {k.name}
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 12.5, color: "var(--text-muted)",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          color: "var(--text-secondary)",
        }}>
          {k.preview}
        </span>
        <span>·</span>
        <span>Created {k.created} by {k.createdBy}</span>
      </div>
    </div>

    <ScopeChip scope={k.scope} />

    <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.4 }}>
      <div>{k.lastUsed === "Never" ? "Never used" : `Last used ${k.lastUsed}`}</div>
      <div style={{ color: "var(--text-muted)", fontSize: 11.5, marginTop: 2 }}>
        {k.usage}
      </div>
    </div>

    <span style={{ color: "var(--text-muted)", justifySelf: "center", cursor: "pointer" }}>
      <IconDots size={16} />
    </span>
  </div>
);

const ScopeChip = ({ scope }) => {
  const palette = {
    read: { bg: "var(--draft-bg)", color: "var(--draft-text)", border: "var(--draft-border)" },
    write: { bg: "var(--accent-light)", color: "var(--accent)", border: "rgba(15,110,86,0.25)" },
    review: { bg: "var(--review-bg)", color: "var(--review-text)", border: "var(--review-border)" },
  }[scope.kind];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      height: 24, padding: "0 10px", borderRadius: 6,
      background: palette.bg, color: palette.color,
      border: `1px solid ${palette.border}`,
      fontSize: 12, fontWeight: 500, letterSpacing: "-0.005em",
      width: "fit-content",
    }}>
      {scope.label}
    </span>
  );
};

// ── Sample data ──────────────────────────────────────────────────────
const SAMPLE_KEYS = [
  {
    name: "Claude Code · Ali's laptop",
    preview: "aqli_live_••••3f2a",
    created: "Jun 1", createdBy: "Ali",
    scope: { kind: "write", label: "Read + write" },
    lastUsed: "2 minutes ago",
    usage: "142 reads · 8 writes this week",
  },
  {
    name: "Cursor · Sara's workstation",
    preview: "aqli_live_••••91c4",
    created: "Apr 18", createdBy: "Sara",
    scope: { kind: "write", label: "Read + write" },
    lastUsed: "1 hour ago",
    usage: "86 reads · 3 writes this week",
  },
  {
    name: "GPT-4o Batch Worker",
    preview: "aqli_live_••••a07b",
    created: "Mar 22", createdBy: "Khalid",
    scope: { kind: "read", label: "Read only" },
    lastUsed: "Never",
    usage: "Connected to Compliance space",
  },
];

// ── Settings · Workspace (the shell, general tab) ────────────────────
const Settings_General = () => (
  <div className="aqli-screen" data-screen-label="Settings · Workspace">
    <SettingsSidebar active="general" />
    <div className="main">
      <TopBar crumbs={["Settings", "Workspace"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
        <SettingsHeader
          title="Workspace"
          sub="The shared layer for your team's docs and agents. Settings here apply to every space and every agent in this workspace."
        />

        <SettingsCard title="Workspace name"
          sub="Shown in the sidebar and at the top of every doc.">
          <FormField label="Name">
            <Input value="Tabadulat" />
          </FormField>
          <FormField label="URL slug" hint="https://your-aqli.app/w/tabadulat">
            <Input value="tabadulat" mono />
          </FormField>
        </SettingsCard>

        <SettingsCard title="Defaults"
          sub="How new docs and agent output start out.">
          <FormField label="Default doc status for human authors">
            <Select value="Draft" />
          </FormField>
          <FormField label="Default doc status for agent authors"
            hint="Agent output should land here until a human approves it.">
            <Select value="Draft" pinned />
          </FormField>
          <FormField label="Stale doc threshold"
            hint="Docs not reviewed in this window are flagged stale.">
            <Select value="90 days" />
          </FormField>
        </SettingsCard>

        <SettingsCard title="AI provider"
          sub="Embeddings and AI features use this key. Bring your own.">
          <FormField label="OpenAI API key">
            <Input value="sk-••••••••••••••••••••••••a7c2" mono />
          </FormField>
          <FormField label="Embedding model">
            <Select value="text-embedding-3-small" mono />
          </FormField>
        </SettingsCard>
      </div>
    </div>
  </div>
);

// ── Settings · API Keys (list, populated) ────────────────────────────
const Settings_Keys = () => (
  <div className="aqli-screen" data-screen-label="Settings · API Keys">
    <SettingsSidebar active="keys" />
    <div className="main">
      <TopBar crumbs={["Settings", "API keys"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "auto" }}>
        <SettingsHeader
          title="API keys"
          sub="Each key lets one agent read approved context and create docs in this workspace. Agent-authored docs land in Draft until a human approves them."
          action={
            <button className="btn btn-primary">
              <IconPlus size={14} sw={2} />
              <span>New API key</span>
            </button>
          }
        />

        {/* Stat strip */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 0,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          marginBottom: 22,
          overflow: "hidden",
        }}>
          <Stat label="Active keys" value="3" />
          <Stat label="Reads · 7 days" value="1,284" />
          <Stat label="Writes · 7 days" value="14" hint="11 approved, 3 pending" />
          <Stat label="Most active" value="Claude Code" hint="2 minutes ago" last />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SAMPLE_KEYS.map((k, i) => <KeyRow key={i} k={k} />)}
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
            See the <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>agent API reference</strong> for endpoint shapes,
            response schemas, and example agents (Claude Code, Cursor, LangChain).
          </div>
          <span style={{ color: "var(--text-secondary)", display: "flex" }}>
            <IconArrowUpRight size={14} />
          </span>
        </div>
      </div>
    </div>
  </div>
);

const Stat = ({ label, value, hint, last }) => (
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
      color: "var(--text-primary)",
      lineHeight: 1.1,
    }}>{value}</span>
    {hint && (
      <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{hint}</span>
    )}
  </div>
);

// ── Settings · API Keys + New Key dialog ─────────────────────────────
const Settings_Keys_NewDialog = () => (
  <div className="aqli-screen" data-screen-label="Settings · New API Key" style={{ position: "relative" }}>
    <SettingsSidebar active="keys" />
    <div className="main">
      <TopBar crumbs={["Settings", "API keys"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "hidden" }}>
        <SettingsHeader
          title="API keys"
          sub="Each key lets one agent read approved context and create docs in this workspace."
          action={
            <button className="btn btn-primary">
              <IconPlus size={14} sw={2} />
              <span>New API key</span>
            </button>
          }
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: 0.4 }}>
          {SAMPLE_KEYS.map((k, i) => <KeyRow key={i} k={k} />)}
        </div>
      </div>
    </div>

    {/* Dialog overlay */}
    <ModalScrim />
    <Modal title="Create API key"
      sub="Generate a key for a new agent. You'll see the full key once.">
      <FormField label="Name" hint="Pick something specific — agent + machine helps if a key needs to be revoked.">
        <Input value="Cursor · Khalid's MacBook" autofocus />
      </FormField>

      <FormField label="Scope" hint="What this agent is allowed to do.">
        <ScopeRadio />
      </FormField>

      <FormField label="Allowed spaces" hint="The agent can only read and write docs in these spaces.">
        <MultiPick />
      </FormField>

      <FormField label="Expires">
        <Select value="Never" />
      </FormField>

      <div style={{
        display: "flex", justifyContent: "flex-end", gap: 8,
        marginTop: 4, paddingTop: 16,
        borderTop: "1px solid var(--border)",
      }}>
        <button className="btn btn-ghost">Cancel</button>
        <button className="btn btn-primary">
          <IconKey size={13} />
          <span>Create key</span>
        </button>
      </div>
    </Modal>
  </div>
);

// ── Settings · API Keys + Reveal dialog ──────────────────────────────
const Settings_Keys_RevealDialog = () => (
  <div className="aqli-screen" data-screen-label="Settings · Reveal Key" style={{ position: "relative" }}>
    <SettingsSidebar active="keys" />
    <div className="main">
      <TopBar crumbs={["Settings", "API keys"]} primary={null} showShare={false} />
      <div className="content" style={{ padding: "32px 44px", overflow: "hidden" }}>
        <SettingsHeader
          title="API keys"
          sub="Each key lets one agent read approved context and create docs in this workspace."
          action={
            <button className="btn btn-primary">
              <IconPlus size={14} sw={2} />
              <span>New API key</span>
            </button>
          }
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: 0.4 }}>
          {SAMPLE_KEYS.map((k, i) => <KeyRow key={i} k={k} />)}
        </div>
      </div>
    </div>

    <ModalScrim />
    <Modal width={520} variant="reveal">
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px",
        background: "var(--review-bg)",
        border: "1px solid var(--review-border)",
        borderRadius: 8,
        marginBottom: 22,
      }}>
        <span style={{ color: "var(--review-text)", display: "flex" }}>
          <IconAlert size={18} />
        </span>
        <div style={{ flex: 1, fontSize: 13, color: "var(--review-text)", lineHeight: 1.5 }}>
          <strong style={{ fontWeight: 600 }}>Save this key now.</strong> This is the only time the full key will be shown. Store it in your password manager or secrets vault.
        </div>
      </div>

      <div style={{
        fontSize: 11, fontWeight: 600,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--text-muted)", marginBottom: 8,
      }}>
        Cursor · Khalid's MacBook
      </div>

      <CodeBlock
        copy
        value="aqli_live_8a3f4d2b9c1e6f0a7b8d3e5c2f4a1d9e7c2"
      />

      <div style={{
        fontSize: 11, fontWeight: 600,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--text-muted)", marginTop: 22, marginBottom: 8,
      }}>
        Quick test
      </div>

      <CodeBlock
        copy
        multi
        value={[
          "curl https://your-aqli.app/api/agent/context \\",
          '  -H "Authorization: Bearer aqli_live_8a3f…" \\',
          '  -G --data-urlencode "query=payout retry"',
        ]}
      />

      <div style={{
        fontSize: 12, color: "var(--text-muted)",
        marginTop: 14, marginBottom: 22,
      }}>
        Add this key as <code style={{
          fontFamily: "var(--font-mono)", fontSize: 11.5,
          background: "var(--bg-sidebar)", padding: "1px 6px",
          borderRadius: 4, color: "var(--text-secondary)",
        }}>AQLI_API_KEY</code> in your agent's environment.
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 8,
        paddingTop: 16, borderTop: "1px solid var(--border)",
      }}>
        <button className="btn btn-ghost" style={{ color: "var(--text-secondary)" }}>
          View agent API docs
        </button>
        <button className="btn btn-primary">
          <IconCheck size={13} sw={2.2} />
          <span>I've saved it</span>
        </button>
      </div>
    </Modal>
  </div>
);

// ── Form primitives ──────────────────────────────────────────────────
const SettingsCard = ({ title, sub, children }) => (
  <section style={{
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "22px 24px",
    marginBottom: 18,
    display: "flex", flexDirection: "column", gap: 16,
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

const FormField = ({ label, hint, children }) => (
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

const Input = ({ value, mono, autofocus }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    height: 36, padding: "0 12px",
    background: "var(--bg-base)",
    border: `1px solid ${autofocus ? "var(--accent)" : "var(--border)"}`,
    boxShadow: autofocus ? "0 0 0 3px rgba(15,110,86,0.12)" : "none",
    borderRadius: 6,
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: mono ? 12.5 : 13.5,
    color: "var(--text-primary)",
  }}>
    {value}
    {autofocus && (
      <span style={{
        width: 1.5, height: 14, background: "var(--accent)",
        marginLeft: -2,
        animation: "aqli-blink 1.05s steps(1) infinite",
      }} />
    )}
  </div>
);

const Select = ({ value, mono, pinned }) => (
  <div style={{
    display: "flex", alignItems: "center",
    height: 36, padding: "0 12px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
    fontSize: mono ? 12.5 : 13.5,
    color: "var(--text-primary)",
    cursor: "pointer",
  }}>
    <span style={{ flex: 1 }}>{value}</span>
    {pinned && (
      <span style={{
        fontSize: 10.5, color: "var(--text-muted)",
        marginRight: 8, fontFamily: "var(--font-sans)",
      }}>
        recommended
      </span>
    )}
    <IconChevDown size={13} />
  </div>
);

const ScopeRadio = () => {
  const opts = [
    { id: "read", label: "Read only", desc: "Query approved docs. Cannot write." },
    { id: "write", label: "Read + write", desc: "Query, then create drafts for human review.", on: true },
    { id: "review", label: "Read + write + review", desc: "Plus mark its own docs for review. For trusted, supervised agents." },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {opts.map((o) => (
        <div key={o.id} style={{
          display: "grid",
          gridTemplateColumns: "20px 1fr",
          gap: 12, alignItems: "start",
          padding: "12px 14px",
          background: o.on ? "var(--accent-light)" : "var(--bg-base)",
          border: `1px solid ${o.on ? "rgba(15,110,86,0.3)" : "var(--border)"}`,
          borderRadius: 8,
          cursor: "pointer",
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 999,
            border: `1.5px solid ${o.on ? "var(--accent)" : "var(--border-strong)"}`,
            background: o.on ? "var(--accent)" : "transparent",
            position: "relative",
            marginTop: 2,
          }}>
            {o.on && (
              <span style={{
                position: "absolute", top: 3, left: 3,
                width: 7, height: 7, borderRadius: 999,
                background: "#fff",
              }} />
            )}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{
              fontSize: 13.5, fontWeight: 500,
              color: o.on ? "var(--accent)" : "var(--text-primary)",
            }}>
              {o.label}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
              {o.desc}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const MultiPick = () => (
  <div style={{
    display: "flex", flexWrap: "wrap", gap: 6,
    padding: "8px 10px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    minHeight: 36,
  }}>
    {["📋 Product", "⚙️ Engineering"].map((t) => (
      <span key={t} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px 3px 8px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        fontSize: 12, color: "var(--text-primary)",
      }}>
        {t}
        <span style={{ color: "var(--text-muted)", marginLeft: 2, cursor: "pointer", display: "flex" }}>
          <IconClose size={10} />
        </span>
      </span>
    ))}
    <span style={{
      fontSize: 12, color: "var(--text-muted)",
      display: "inline-flex", alignItems: "center", padding: "0 4px",
    }}>
      + Add space
    </span>
  </div>
);

// ── Modal ────────────────────────────────────────────────────────────
const ModalScrim = () => (
  <div style={{
    position: "absolute", inset: 0,
    background: "rgba(20, 20, 18, 0.32)",
    zIndex: 50,
  }} />
);

const Modal = ({ title, sub, width = 480, children }) => (
  <div style={{
    position: "absolute", top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    width,
    maxHeight: "calc(100% - 64px)",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    boxShadow: "0 18px 48px -12px rgba(20,20,18,0.32), 0 2px 6px rgba(20,20,18,0.06)",
    padding: "24px 26px",
    zIndex: 51,
    display: "flex", flexDirection: "column", gap: 18,
  }}>
    {(title || sub) && (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {title && (
          <h2 style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 22,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}>
            {title}
          </h2>
        )}
        {sub && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {sub}
          </p>
        )}
      </div>
    )}
    {children}
  </div>
);

const CodeBlock = ({ value, copy, multi }) => (
  <div style={{
    position: "relative",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: multi ? "12px 14px" : "10px 14px",
    fontFamily: "var(--font-mono)",
    fontSize: 12.5,
    color: "var(--text-primary)",
    lineHeight: 1.6,
    whiteSpace: "pre",
    overflow: "hidden",
  }}>
    <div style={{ paddingRight: copy ? 30 : 0 }}>
      {multi ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {value.map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
      ) : value}
    </div>
    {copy && (
      <button style={{
        position: "absolute", top: 8, right: 8,
        width: 26, height: 26, borderRadius: 5,
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        color: "var(--text-secondary)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
      }}>
        <IconCopy size={13} />
      </button>
    )}
  </div>
);

Object.assign(window, {
  Settings_General,
  Settings_Keys,
  Settings_Keys_NewDialog,
  Settings_Keys_RevealDialog,
});

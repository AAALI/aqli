// Aqli — Onboarding flow (5 steps, no app shell)
const { AqliMark, IconCheck, IconPlus, IconKey, IconFolder, IconArrowUpRight,
  IconSparkle, IconRobot, IconChevDown } = window;

// ── Shared step rail ────────────────────────────────────────────────
const STEPS = [
  { n: 1, key: "account", label: "Account", hint: "Email + password" },
  { n: 2, key: "workspace", label: "Workspace", hint: "Team or org" },
  { n: 3, key: "spaces", label: "Spaces", hint: "How docs are organised" },
  { n: 4, key: "agent", label: "Agent", hint: "API key for AI" },
  { n: 5, key: "done", label: "Open workspace", hint: "You’re set" },
];

const StepRail = ({ currentKey }) => {
  const currentIdx = STEPS.findIndex((s) => s.key === currentKey);
  return (
    <aside style={{
      width: 320, flex: "0 0 320px",
      background: "var(--bg-sidebar)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      padding: "36px 32px 28px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 48 }}>
        <AqliMark size={22} />
        <span style={{ fontSize: 17, letterSpacing: "0.08em", fontWeight: 500, color: "var(--text-primary)" }}>aqli</span>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4,
        }}>
          Set up
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          About 3 minutes
        </div>
      </div>

      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
        {STEPS.map((s, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <li key={s.key} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              padding: "10px 0",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 999,
                background: isDone ? "var(--accent)" : isCurrent ? "var(--bg-card)" : "transparent",
                border: isCurrent ? `1.5px solid var(--accent)` : isDone ? "1.5px solid var(--accent)" : "1.5px solid var(--border-strong)",
                color: isDone ? "#fff" : isCurrent ? "var(--accent)" : "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600,
                flex: "0 0 22px",
                marginTop: 1,
              }}>
                {isDone ? <IconCheck size={12} /> : s.n}
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: isCurrent ? 500 : 400,
                  color: isCurrent ? "var(--text-primary)" : isDone ? "var(--text-secondary)" : "var(--text-muted)",
                  letterSpacing: "-0.005em",
                  lineHeight: 1.25,
                }}>{s.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.25 }}>{s.hint}</div>
              </div>
            </li>
          );
        })}
      </ol>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        <a style={{
          fontSize: 12.5, color: "var(--text-secondary)",
          textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
          cursor: "pointer",
        }}>
          <span style={{ color: "var(--text-muted)" }}>docs.aqli.app</span>
          <IconArrowUpRight size={11} />
        </a>
        <a style={{
          fontSize: 12.5, color: "var(--text-secondary)",
          textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
          cursor: "pointer",
        }}>
          <span style={{ color: "var(--text-muted)" }}>github.com/AAALI/aqli</span>
          <IconArrowUpRight size={11} />
        </a>
      </div>
    </aside>
  );
};

const Stage = ({ children, eyebrow, title, sub, footer, topRight }) => (
  <div style={{
    flex: 1, minWidth: 0,
    background: "var(--bg-base)",
    display: "flex", flexDirection: "column",
    position: "relative",
  }}>
    {/* Top minor */}
    <div style={{
      height: 56, padding: "0 32px",
      display: "flex", alignItems: "center", justifyContent: "flex-end",
      fontSize: 12.5, color: "var(--text-muted)",
    }}>
      {topRight}
    </div>

    <div style={{
      flex: 1, padding: "12px 40px 56px",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: 0,
    }}>
      <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 32 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {eyebrow && (
            <div style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "var(--accent)",
            }}>{eyebrow}</div>
          )}
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontSize: 40, lineHeight: 1.05, fontWeight: 400,
            letterSpacing: "-0.02em",
            color: "var(--text-primary)",
          }}>{title}</h1>
          {sub && (
            <p style={{
              margin: 0, fontSize: 15, lineHeight: 1.55,
              color: "var(--text-secondary)",
              maxWidth: 520,
            }}>{sub}</p>
          )}
        </header>

        {children}

        {footer && <div>{footer}</div>}
      </div>
    </div>
  </div>
);

// ── Form primitives ─────────────────────────────────────────────────
const Field = ({ label, hint, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{
      fontSize: 11.5, fontWeight: 500, letterSpacing: "0.04em",
      textTransform: "uppercase", color: "var(--text-secondary)",
    }}>{label}</span>
    {children}
    {hint && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{hint}</span>}
  </label>
);

const TextInput = ({ value, placeholder, prefix, suffix, focused = false, mono = false }) => (
  <div style={{
    display: "flex", alignItems: "center",
    height: 42,
    padding: "0 12px",
    border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 8,
    background: "var(--bg-card)",
    boxShadow: focused ? "0 0 0 3px rgba(15,110,86,0.12)" : "none",
    transition: "all 80ms",
    fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
  }}>
    {prefix && <span style={{ color: "var(--text-muted)", fontSize: 13, marginRight: 6 }}>{prefix}</span>}
    <input
      defaultValue={value}
      placeholder={placeholder}
      style={{
        flex: 1, border: 0, outline: 0, background: "transparent",
        fontFamily: "inherit",
        fontSize: mono ? 13 : 14, color: "var(--text-primary)",
      }}
    />
    {suffix && <span style={{ color: "var(--text-muted)", fontSize: 13, marginLeft: 6 }}>{suffix}</span>}
  </div>
);

// ── Step 1 — Sign up ────────────────────────────────────────────────
const Onboarding1_SignUp = () => (
  <div className="aqli-screen" data-screen-label="Onboarding · 1 Sign up">
    <StepRail currentKey="account" />
    <Stage
      eyebrow="Step 1 of 5"
      title="Set up your account."
      sub="Aqli is the shared intellect for human–agent teams. You'll be writing in under five minutes."
      topRight={
        <span style={{ whiteSpace: "nowrap" }}>
          Already have an account?{" "}
          <a style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500, cursor: "pointer" }}>Log in</a>
        </span>
      }
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, maxWidth: 320 }}>
            By continuing you agree to the&nbsp;
            <a style={{ color: "var(--text-secondary)", textDecoration: "underline", textDecorationColor: "var(--border-strong)" }}>Terms</a>
            &nbsp;and&nbsp;
            <a style={{ color: "var(--text-secondary)", textDecoration: "underline", textDecorationColor: "var(--border-strong)" }}>Privacy policy</a>.
          </span>
          <button className="btn btn-primary" style={{ height: 38, padding: "0 18px" }}>Continue →</button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Work email">
          <TextInput value="ali@airbnb.com" focused />
        </Field>
        <Field label="Password" hint="At least 12 characters. We never see it.">
          <TextInput value="••••••••••••••••" />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }}></div>
          <span style={{ fontSize: 11.5, color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }}></div>
        </div>

        <button className="btn btn-secondary" style={{ height: 42, justifyContent: "center", fontSize: 13.5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.3v3.4c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
          Continue with GitHub
        </button>
      </div>
    </Stage>
  </div>
);

// ── Step 2 — Create workspace ───────────────────────────────────────
const Onboarding2_Workspace = () => (
  <div className="aqli-screen" data-screen-label="Onboarding · 2 Workspace">
    <StepRail currentKey="workspace" />
    <Stage
      eyebrow="Step 2 of 5"
      title="Name your workspace."
      sub="One workspace per team or organisation. You can rename it later."
      topRight={<span>Signed in as <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>ali@airbnb.com</span></span>}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="btn btn-ghost" style={{ height: 38, padding: "0 14px" }}>← Back</button>
          <button className="btn btn-primary" style={{ height: 38, padding: "0 18px" }}>Continue →</button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label="Workspace name">
          <TextInput value="Airbnb" focused />
        </Field>
        <Field label="Workspace URL" hint="Used for share links and the agent API base URL.">
          <TextInput value="airbnb" prefix="aqli.app /" mono />
        </Field>

        <div style={{
          padding: "16px 18px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-card)",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <span style={{ color: "var(--accent)", marginTop: 1 }}><IconSparkle size={16} /></span>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            We'll provision a Postgres + pgvector database, embed your docs as you write, and expose a workspace-scoped API at <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>aqli.app/airbnb/api</span>.
          </div>
        </div>
      </div>
    </Stage>
  </div>
);

// ── Step 3 — Choose spaces ──────────────────────────────────────────
const SUGGESTED_SPACES = [
  { emoji: "📋", name: "Product", desc: "PRDs, decisions, roadmap", on: true },
  { emoji: "⚙️", name: "Engineering", desc: "ADRs, runbooks, fix notes", on: true },
  { emoji: "🛡️", name: "Trust & Safety", desc: "Policies, hold rules, audit", on: true },
  { emoji: "🔧", name: "Ops", desc: "Runbooks, incident reports", on: false },
  { emoji: "🏢", name: "Company", desc: "Handbook, onboarding", on: false },
];

const SpaceCheckRow = ({ s }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 14,
    padding: "14px 16px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: s.on ? "rgba(15,110,86,0.04)" : "var(--bg-card)",
    borderColor: s.on ? "rgba(15,110,86,0.2)" : "var(--border)",
    cursor: "pointer",
  }}>
    <span style={{
      width: 18, height: 18, borderRadius: 4,
      border: s.on ? "1.5px solid var(--accent)" : "1.5px solid var(--border-strong)",
      background: s.on ? "var(--accent)" : "var(--bg-card)",
      color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      flex: "0 0 18px",
    }}>
      {s.on && <IconCheck size={12} />}
    </span>
    <span style={{ fontSize: 18, lineHeight: 1, filter: "saturate(0.85)" }}>{s.emoji}</span>
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{s.name}</span>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.desc}</span>
    </div>
  </div>
);

const Onboarding3_Spaces = () => (
  <div className="aqli-screen" data-screen-label="Onboarding · 3 Spaces">
    <StepRail currentKey="spaces" />
    <Stage
      eyebrow="Step 3 of 5"
      title="What lives where?"
      sub="Spaces are how Aqli organises docs. Start with what fits — add or remove anytime."
      topRight={<span>Workspace <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Airbnb</span></span>}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="btn btn-ghost" style={{ height: 38, padding: "0 14px" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>3 selected</span>
            <button className="btn btn-primary" style={{ height: 38, padding: "0 18px" }}>Create spaces →</button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SUGGESTED_SPACES.map((s) => <SpaceCheckRow key={s.name} s={s} />)}
        <button style={{
          padding: "12px 16px",
          border: "1px dashed var(--border-strong)",
          borderRadius: 8,
          background: "transparent",
          color: "var(--text-secondary)",
          fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          cursor: "pointer", fontFamily: "var(--font-sans)",
          whiteSpace: "nowrap",
        }}>
          <IconPlus size={14} /> Add a custom space
        </button>
      </div>
    </Stage>
  </div>
);

// ── Step 4 — Connect an agent ───────────────────────────────────────
const Onboarding4_Agent = () => (
  <div className="aqli-screen" data-screen-label="Onboarding · 4 Agent">
    <StepRail currentKey="agent" />
    <Stage
      eyebrow="Step 4 of 5"
      title="Connect your first agent."
      sub="An API key lets Claude Code, Cursor, or any agent query Aqli for context and write back what they did. You can skip and do this later from Settings."
      topRight={<span>Workspace <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Airbnb</span></span>}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="btn btn-ghost" style={{ height: 38, padding: "0 14px" }}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <a style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Skip for now</a>
            <button className="btn btn-primary" style={{ height: 38, padding: "0 18px" }}>Continue →</button>
          </div>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Agent identity */}
        <Field label="Agent name" hint="So you can recognise it in audit logs.">
          <TextInput value="Claude Code · Airbnb monorepo" focused />
        </Field>

        {/* Generated key */}
        <div style={{
          padding: "16px 18px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-card)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--accent)" }}><IconKey size={14} /></span>
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-secondary)" }}>
              API key
            </span>
            <span className="badge badge-review" style={{ marginLeft: "auto" }}>Shown once</span>
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 13,
            color: "var(--text-primary)",
            background: "var(--bg-sidebar)",
            padding: "12px 14px", borderRadius: 6,
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              aqli_live_sk_8f3c·1d2e·6a4f·7b9c·····················
            </span>
            <button className="btn btn-secondary" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
              Copy
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            Store this somewhere safe. We hash it on disk and can't show it to you again. Revoke anytime in Settings → API Keys.
          </div>
        </div>

        {/* Example curl */}
        <div style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "#13131A",
          padding: "14px 16px",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A8980" }}>
              Test it
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#6B6A64", fontFamily: "var(--font-mono)" }}>bash</span>
          </div>
          <pre style={{
            margin: 0, fontFamily: "var(--font-mono)", fontSize: 12.5,
            color: "#E5E4DF", lineHeight: 1.65, whiteSpace: "pre-wrap",
          }}>
            <span style={{ color: "#6DD3AE" }}>curl</span> https://aqli.app/airbnb/api/context \{"\n"}
            {"  "}-H <span style={{ color: "#FAC775" }}>"Authorization: Bearer aqli_live_sk_…"</span> \{"\n"}
            {"  "}-G --data-urlencode <span style={{ color: "#FAC775" }}>"query=host payout schedule"</span>
          </pre>
        </div>
      </div>
    </Stage>
  </div>
);

// ── Step 5 — Done ───────────────────────────────────────────────────
const Onboarding5_Done = () => (
  <div className="aqli-screen" data-screen-label="Onboarding · 5 Ready">
    <StepRail currentKey="done" />
    <Stage
      eyebrow="All set"
      title="Welcome to Aqli, Ali."
      sub="Your workspace is live at aqli.app/airbnb. Three spaces are ready and one agent is connected. The next move is yours."
      topRight={<span>Workspace <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>Airbnb</span></span>}
      footer={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", cursor: "pointer" }}>
            Or import from Notion or Markdown →
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn btn-secondary" style={{ height: 38, padding: "0 16px" }}>Open workspace</button>
            <button className="btn btn-primary" style={{ height: 38, padding: "0 18px" }}>
              <IconPlus size={14} />Write your first doc
            </button>
          </div>
        </div>
      }
    >
      {/* Summary cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SummaryRow
          icon={<IconFolder />}
          label="Spaces"
          value="Product · Engineering · Trust & Safety"
        />
        <SummaryRow
          icon={<IconKey />}
          label="Agent connected"
          value="Claude Code · Airbnb monorepo"
          meta="aqli_live_sk_8f3c…"
        />
        <SummaryRow
          icon={<IconRobot />}
          label="Workspace URL"
          value="aqli.app/airbnb"
          meta="Live"
        />
      </div>

      {/* Suggested next */}
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg-card)",
        padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "var(--text-muted)",
        }}>
          Suggested first docs
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SuggestRow type="PRD" title="The thing you're building this week" />
          <SuggestRow type="ADR" title="A decision you've already made" />
          <SuggestRow type="Runbook" title="The on-call thing nobody wrote down" />
        </div>
      </div>
    </Stage>
  </div>
);

const SummaryRow = ({ icon, label, value, meta }) => (
  <div style={{
    padding: "12px 16px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-card)",
    display: "flex", alignItems: "center", gap: 14,
  }}>
    <span style={{
      width: 32, height: 32, borderRadius: 8,
      background: "var(--accent-light)", color: "var(--accent)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flex: "0 0 32px",
    }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--text-muted)",
      }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
    </div>
    {meta && (
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11.5,
        color: "var(--text-muted)",
      }}>{meta}</span>
    )}
    <span style={{ color: "var(--accent)" }}><IconCheck size={16} /></span>
  </div>
);

const SuggestRow = ({ type, title }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 0",
    cursor: "pointer",
  }}>
    <span className="badge badge-type">{type}</span>
    <span style={{ fontSize: 13.5, color: "var(--text-primary)", flex: 1 }}>{title}</span>
    <span style={{ color: "var(--text-muted)" }}><IconArrowUpRight size={14} /></span>
  </div>
);

Object.assign(window, {
  Onboarding1_SignUp,
  Onboarding2_Workspace,
  Onboarding3_Spaces,
  Onboarding4_Agent,
  Onboarding5_Done,
});

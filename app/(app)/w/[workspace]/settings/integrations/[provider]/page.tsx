import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import AppTopBar from "@/components/layout/AppTopBar";
import { SettingsCard, Toggle, RadioRow, Switch } from "@/components/settings/primitives";
import { providerLogo } from "@/components/settings/BrandLogos";
import { IconChevLeft, IconChevDown, IconPlus, IconLock, IconHash } from "@/components/aqli/icons";

const TITLES: Record<string, string> = { linear: "Linear", slack: "Slack", github: "GitHub", mcp: "MCP server" };

export default async function IntegrationDetailPage({
  params,
}: {
  params: Promise<{ workspace: string; provider: string }>;
}) {
  const { workspace: wsSlug, provider } = await params;
  if (!TITLES[provider]) notFound();
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;
  const settingsBase = `${base}/settings`;
  const title = TITLES[provider];

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: settingsBase }, { label: "Integrations", href: `${settingsBase}/integrations` }, { label: title }]} />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <Link href={`${settingsBase}/integrations`} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", padding: "4px 8px", margin: "0 -8px 16px", borderRadius: 6, textDecoration: "none" }}>
            <IconChevLeft size={14} /><span>All integrations</span>
          </Link>

          <Hero provider={provider} title={title} />

          {provider === "linear" && <LinearConfig />}
          {provider === "slack" && <SlackConfig />}
          {provider === "github" && <GitHubConfig />}
          {provider === "mcp" && <McpConfig />}
        </div>
      </div>
    </>
  );
}

function Hero({ provider, title }: { provider: string; title: string }) {
  const subs: Record<string, string> = {
    linear: "Aqli reads your Linear projects and issues. Paste a Linear URL into any doc and Aqli will show an inline preview with status, assignee, and a deep link.",
    slack: "Aqli posts to Slack so the review loop never disappears into the app. Map each event type to a channel, or mute it entirely.",
    github: "Mirror approved docs to a Git repo as Markdown. Useful for engineering teams that want a Git-native copy of the knowledge base or for CI to read.",
    mcp: "Expose your Aqli context to any MCP-compatible agent natively, without an API key.",
  };
  const connected = provider !== "mcp" && provider !== "github" ? true : provider === "github";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, paddingBottom: 22, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
      {providerLogo(provider, 48)}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 30, letterSpacing: "-0.015em" }}>{title}</h1>
          {connected && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 8px", borderRadius: 6, background: "var(--approved-bg)", color: "var(--approved-text)", border: "1px solid var(--approved-border)", fontSize: 11.5, fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
              Connected to <strong style={{ fontWeight: 600 }}>tabadulat</strong>
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", maxWidth: 720, lineHeight: 1.55 }}>{subs[provider]}</p>
      </div>
      <button className="btn btn-secondary" style={connected ? { color: "#993C1D" } : undefined}>{connected ? "Disconnect" : "Connect"}</button>
    </div>
  );
}

function LinearConfig() {
  const projects = [
    { code: "TAB", name: "Tabadulat — Core platform", issues: 142, on: true },
    { code: "TAB-OPS", name: "Tabadulat — Ops & Tooling", issues: 38, on: true },
    { code: "TAB-TS", name: "Tabadulat — Trust & Safety", issues: 22, on: true },
    { code: "WIK", name: "Wikime", issues: 84, on: false },
    { code: "SIRO", name: "SIRO & CO — Internal", issues: 17, on: false },
  ];
  return (
    <>
      <SettingsCard title="Behaviour" sub="What Aqli does when it sees a Linear URL or links a doc to an issue.">
        <Toggle on label="Detect Linear URLs in doc bodies" desc="Wrap raw URLs into rich preview cards with status, assignee, and deep link." />
        <Toggle on label="Add Aqli link back to Linear" desc="When a doc is linked to an issue, post a back-link comment on the Linear issue." />
        <Toggle label="Auto-mark Aqli docs as 'In Progress' source" desc="When the linked Linear issue moves to In Progress, mark the doc as actively referenced." />
      </SettingsCard>
      <SettingsCard title="Project sync" sub="Only docs linked to projects you sync will get rich previews. Synced projects: 3 of 5.">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map((p) => (
            <div key={p.code} style={{ display: "grid", gridTemplateColumns: "40px 1fr auto 36px", gap: 14, alignItems: "center", padding: "10px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 6, background: p.on ? "rgba(94,106,210,0.12)" : "var(--bg-sidebar)", color: p.on ? "#3B49C3" : "var(--text-muted)", border: `1px solid ${p.on ? "rgba(94,106,210,0.25)" : "var(--border)"}`, fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{p.code}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{p.name}</span>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.issues} issues · {p.on ? "synced 4 minutes ago" : "not syncing"}</span>
              </div>
              <span style={{ fontSize: 11.5, color: p.on ? "var(--approved-text)" : "var(--text-muted)" }}>{p.on ? "Synced" : "Available"}</span>
              <Switch on={p.on} />
            </div>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard title="Default link behaviour" sub="When agents create a Fix Note, how should they link back to Linear?">
        <RadioRow on label="Link to triggering issue" desc="If the agent was given a Linear issue as input, the new doc links to that issue automatically." />
        <RadioRow label="Prompt the agent each time" desc="Agent must explicitly include linear_issue_id in the create-doc call." />
        <RadioRow label="No automatic linking" desc="Aqli will not add Linear links to agent-authored docs." />
      </SettingsCard>
    </>
  );
}

function SlackConfig() {
  const events = [
    { name: "Review requested", desc: "Sent when an agent or human asks for review on a doc", channel: "#doc-review", on: true },
    { name: "Doc approved", desc: "Sent when a doc is approved and becomes ground truth", channel: "#doc-review", on: true },
    { name: "Changes requested", desc: "Sent when a reviewer asks an agent to revise a doc", channel: "#doc-review", on: true },
    { name: "Doc went stale", desc: "Daily digest of docs crossing the 90-day threshold", channel: "#aqli-hygiene", on: true },
    { name: "Agent submitted draft", desc: "Real-time: an agent created a new Draft", channel: "—", on: false },
    { name: "@mentions", desc: "Sent only to the mentioned user (via Slack DM)", channel: "DM", on: true },
  ];
  return (
    <>
      <SettingsCard title="Connection" sub="The Slack workspace this Aqli workspace posts to.">
        <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 14, alignItems: "center", padding: "12px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <span style={{ width: 36, height: 36, borderRadius: 8, background: "#3F0F3F", color: "#fff", fontFamily: "var(--font-serif)", fontSize: 16, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>T</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Tabadulat</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>tabadulat.slack.com · connected by Sara · Apr 18</span>
          </div>
          <button className="btn btn-secondary">Re-authorize</button>
        </div>
      </SettingsCard>
      <SettingsCard title="Event routing" sub="One channel per event type. Use DMs for personal notifications like @mentions.">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {events.map((e) => (
            <div key={e.name} style={{ display: "grid", gridTemplateColumns: "1fr 240px 40px", gap: 14, alignItems: "center", padding: "12px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, opacity: e.on ? 1 : 0.55 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{e.name}</span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{e.desc}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, height: 32, padding: "0 10px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12.5, color: e.on ? "var(--text-primary)" : "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                <span style={{ color: "var(--text-secondary)", display: "flex" }}><IconHash size={13} /></span>
                <span style={{ flex: 1 }}>{e.channel}</span>
                <IconChevDown size={12} />
              </div>
              <Switch on={e.on} />
            </div>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard title="Posting style">
        <Toggle on label="Rich previews with doc title + status badge" desc="Falls back to plain links if Slack blocks rich unfurls." />
        <Toggle on label="Include AI summary in review-request posts" desc="One-paragraph TL;DR so reviewers can triage from Slack." />
        <Toggle label="Threaded replies for follow-ups" desc="Approve / Request changes events thread under the original review request." />
      </SettingsCard>
      <SettingsCard title="Mute hours" sub="Aqli holds non-urgent posts until your workspace is back online.">
        <div style={{ display: "flex", gap: 10 }}>
          <Picker label="Quiet from" value="19:00" />
          <Picker label="Until" value="08:00" />
          <Picker label="Timezone" value="Asia/Dubai · GST" wide />
        </div>
      </SettingsCard>
    </>
  );
}

function GitHubConfig() {
  const repos = [
    { code: "tabadulat/aqli-mirror", spaces: "All spaces", branch: "main", on: true, primary: true },
    { code: "tabadulat/runbooks", spaces: "Engineering only", branch: "main", on: true },
    { code: "tabadulat/policies", spaces: "Trust & Safety only", branch: "main", on: false },
    { code: "tabadulat/web", spaces: "Not synced", branch: "—", on: false },
  ];
  return (
    <>
      <SettingsCard title="Mirror behaviour" sub="What Aqli does when a doc reaches certain states.">
        <Toggle on label="Commit on Approved" desc="When a doc moves to Approved, commit the latest version to the linked repo." />
        <Toggle on label="Open PR for In Review docs" desc="Pushes a branch + draft PR so engineers can review in their existing flow." />
        <Toggle label="Mirror agent-authored docs only" desc="Skip human-written docs (keep them Aqli-only). Useful if humans use Aqli as a draft layer." />
        <Toggle on label="Include Aqli metadata as frontmatter" desc="YAML frontmatter with status, owner, reviewers, agent attribution." />
      </SettingsCard>
      <SettingsCard title="Repositories" sub="One primary repo for everything, or one per space. The primary repo holds workspace-wide docs.">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {repos.map((r) => (
            <div key={r.code} style={{ display: "grid", gridTemplateColumns: "40px 1fr 100px 110px 110px 36px", gap: 14, alignItems: "center", padding: "12px 14px", background: "var(--bg-base)", border: `1px solid ${r.primary ? "rgba(15,110,86,0.25)" : "var(--border)"}`, boxShadow: r.primary ? "0 0 0 2px rgba(15,110,86,0.05)" : "none", borderRadius: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{providerLogo("github", 20)}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{r.code}</span>
                  {r.primary && <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 3, background: "var(--accent)", color: "#fff" }}>Primary</span>}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{r.spaces}</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: r.on ? "var(--text-secondary)" : "var(--text-muted)" }}>{r.branch}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--text-muted)" }}><IconLock size={11} />private</span>
              <span style={{ fontSize: 11.5, color: r.on ? "var(--approved-text)" : "var(--text-muted)" }}>{r.on ? "Mirroring" : "Available"}</span>
              <Switch on={r.on} />
            </div>
          ))}
        </div>
        <button style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 6, background: "var(--bg-base)", border: "1px dashed var(--border-strong)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, cursor: "pointer", width: "fit-content" }}>
          <IconPlus size={13} sw={2} />Map another repo
        </button>
      </SettingsCard>
      <SettingsCard title="Commit identity" sub="GitHub user the commits show up under. Use a bot account in production.">
        <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 14, alignItems: "center", padding: "12px 14px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <span style={{ width: 36, height: 36, borderRadius: 999, background: "#1A1A18", color: "#fff", fontFamily: "var(--font-mono)", fontWeight: 600, fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>AQ</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>aqli-bot</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>bot@aqli.app · GitHub App</span>
          </div>
          <button className="btn btn-secondary">Change</button>
        </div>
      </SettingsCard>
    </>
  );
}

function McpConfig() {
  return (
    <SettingsCard title="MCP endpoint" sub="Point any MCP-compatible client at this URL to expose your approved docs as tools.">
      <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-primary)" }}>
        https://your-aqli.app/api/mcp
      </div>
      <Toggle on label="Read approved docs" desc="MCP clients can query approved context across allowed spaces." />
      <Toggle label="Allow draft creation" desc="MCP clients can create Draft docs for human review." />
    </SettingsCard>
  );
}

function Picker({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={{ flex: wide ? 2 : 1, display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11.5, color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", height: 34, padding: "0 12px", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
        <span style={{ flex: 1 }}>{value}</span>
        <IconChevDown size={12} />
      </div>
    </div>
  );
}

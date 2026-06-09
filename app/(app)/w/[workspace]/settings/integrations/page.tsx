import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { listIntegrationConnections } from "@/lib/supabase/integration-connections";
import AppTopBar from "@/components/layout/AppTopBar";
import { SettingsHeader, StatCell } from "@/components/settings/primitives";
import { providerLogo } from "@/components/settings/BrandLogos";
import { IconArrowUpRight, IconBook } from "@/components/aqli/icons";
import type { IntegrationConnection, IntegrationProvider } from "@/types/integration";

const ITEMS: {
  id: IntegrationProvider;
  name: string;
  desc: string;
}[] = [
  {
    id: "linear",
    name: "Linear",
    desc: "Connect project and issue context. Aqli prefers Linear links when deciding which doc a merged PR should update.",
  },
  {
    id: "github",
    name: "GitHub",
    desc: "Watch merged pull requests, update linked docs, or create focused Fix Notes when no Linear ticket exists.",
  },
];

export default async function SettingsIntegrationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  // Let auth/DB failures surface — silently rendering "no integrations"
  // misleads admins during outages or permission regressions.
  const connections = await listIntegrationConnections(workspace.id);
  const base = `/w/${workspace.slug}`;
  const settingsBase = `${base}/settings`;
  const connected = connections.filter((connection) => connection.status === "connected").length;
  // Pick the connection whose last_event_at is the most recent so the stat
  // shows the newest webhook event (not just the first row with a timestamp).
  const last = connections
    .filter((connection) => connection.last_event_at)
    .reduce<IntegrationConnection | undefined>((latest, connection) => {
      if (!latest) return connection;
      const a = connection.last_event_at ? Date.parse(connection.last_event_at) : 0;
      const b = latest.last_event_at ? Date.parse(latest.last_event_at) : 0;
      return a > b ? connection : latest;
    }, undefined);

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: settingsBase }, { label: "Integrations" }]} />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <SettingsHeader
            title="Integrations"
            sub="Connect Aqli to source systems. Integrations are workspace-scoped and keep agent-authored knowledge in review until a human approves it."
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 26, overflow: "hidden" }}>
            <StatCell label="Connected" value={String(connected)} />
            <StatCell label="Available" value="2" hint="GitHub + Linear" />
            <StatCell label="Most recent event" value={last ? providerName(last.provider) : "None"} hint={last?.last_event_at ? new Date(last.last_event_at).toLocaleString() : "No webhook events yet"} last />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ITEMS.map((item) => (
              <IntegrationCard
                key={item.id}
                item={item}
                connection={connections.find((connection) => connection.provider === item.id)}
                settingsBase={settingsBase}
              />
            ))}
          </div>

          <div style={{ marginTop: 28, padding: "16px 20px", background: "var(--bg-sidebar)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 28, height: 28, borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              <IconBook size={14} />
            </span>
            <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              GitHub PR events create review docs when they cannot be matched to a Linear-linked doc. Approved docs remain the only trusted context for agents.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function IntegrationCard({
  item,
  connection,
  settingsBase,
}: {
  item: { id: IntegrationProvider; name: string; desc: string };
  connection?: IntegrationConnection;
  settingsBase: string;
}) {
  const connected = connection?.status === "connected";
  const detailHref = `${settingsBase}/integrations/${item.id}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 18, alignItems: "center", padding: "20px 22px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
      {providerLogo(item.id, 36)}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{item.name}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 8px", borderRadius: 6, background: connected ? "var(--approved-bg)" : "var(--bg-sidebar)", color: connected ? "var(--approved-text)" : "var(--text-muted)", border: `1px solid ${connected ? "var(--approved-border)" : "var(--border)"}`, fontSize: 11.5, fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
            {connected ? "Connected" : connection?.status ?? "Not connected"}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.desc}</div>
        <div style={{ fontSize: 12, color: connection?.last_error ? "#993C1D" : "var(--text-muted)", marginTop: 2 }}>
          {connection?.last_error ?? connectionMeta(connection)}
        </div>
      </div>
      <Link href={detailHref} className={connected ? "btn btn-secondary" : "btn btn-primary"}>
        <span>{connected ? "Configure" : "Connect"}</span>
        {!connected && <IconArrowUpRight size={12} />}
      </Link>
    </div>
  );
}

function providerName(provider: string) {
  return provider === "github" ? "GitHub" : "Linear";
}

function connectionMeta(connection?: IntegrationConnection) {
  if (!connection) return "Use Composio managed OAuth. Tokens are stored in Composio, not Aqli.";
  if (connection.provider === "github") {
    const repos = Array.isArray(connection.metadata.repositories) ? connection.metadata.repositories.length : 0;
    return repos ? `${repos} repo${repos === 1 ? "" : "s"} watched for merged PRs.` : "Connected. Add a repo on the GitHub integration page.";
  }
  return "Connected. Linear context will be used when PRs mention an issue key.";
}

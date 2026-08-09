import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import { getIntegrationConnection } from "@/lib/supabase/integration-connections";
import { getGitHubPolicyStats, type GitHubPolicyStats } from "@/lib/supabase/github-stats";
import { isAutoApproveEnabled } from "@/lib/integrations/source/feature-doc";
import AppTopBar from "@/components/layout/AppTopBar";
import { SettingsCard, SettingsHeader, StatCell } from "@/components/settings/primitives";
import { providerLogo } from "@/components/settings/BrandLogos";
import GitHubRepoPicker from "@/components/integrations/GitHubRepoPicker";
import AutoApprovePolicyToggle from "@/components/integrations/AutoApprovePolicyToggle";
import { IconChevLeft } from "@/components/aqli/icons";
import { formatRelative } from "@/lib/utils";
import GitHubTokenForm from "@/components/integrations/GitHubTokenForm";
import type { IntegrationProvider } from "@/types/integration";
import type { Space } from "@/types/space";

const TITLES: Record<IntegrationProvider, string> = {
  github: "GitHub",
  linear: "Linear",
};

export default async function IntegrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; provider: string }>;
  searchParams?: Promise<{ status?: string }>;
}) {
  const { workspace: wsSlug, provider: rawProvider } = await params;
  if (rawProvider !== "github" && rawProvider !== "linear") notFound();
  const provider = rawProvider as IntegrationProvider;
  const status = (await searchParams)?.status;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const [spaces, connection, stats] = await Promise.all([
    getSpaces(workspace.id),
    // Let real failures (auth, DB) surface so users aren't shown a misleading
    // "disconnected" state during outages or permission regressions.
    getIntegrationConnection(workspace.id, provider),
    provider === "github" ? getGitHubPolicyStats(workspace.id) : Promise.resolve(null),
  ]);
  const base = `/w/${workspace.slug}`;
  const settingsBase = `${base}/settings`;
  const connected = connection?.status === "connected";

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: settingsBase }, { label: "Integrations", href: `${settingsBase}/integrations` }, { label: TITLES[provider] }]} />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <Link href={`${settingsBase}/integrations`} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-secondary)", padding: "4px 8px", margin: "0 -8px 16px", borderRadius: 6, textDecoration: "none" }}>
            <IconChevLeft size={14} /><span>All integrations</span>
          </Link>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, paddingBottom: 22, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
            {providerLogo(provider, 48)}
            <SettingsHeader
              title={TITLES[provider]}
              sub={provider === "github"
                ? "Watch merged pull requests. Aqli updates a matching Linear-linked doc when it can, otherwise it creates a focused Fix Note for review."
                : "Connect Linear so PRs can be matched to project-management context when issue keys are present."}
            />
          </div>

          {status && (() => {
            // Only show the success banner if the connection actually reports
            // as connected; otherwise the URL flag could mislead users when
            // the callback flow updated the row to failed/expired.
            const showSuccess = status === "connected" && connected;
            const showFailure = status !== "connected" || !connected;
            return (
              <div style={{ marginBottom: 18, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: showSuccess ? "var(--approved-bg)" : "var(--bg-sidebar)", color: showSuccess ? "var(--approved-text)" : "var(--text-secondary)", fontSize: 13 }}>
                {showSuccess ? "Connection saved." : showFailure ? "Connection was not completed." : ""}
              </div>
            );
          })()}

          {provider === "github" ? (
            <GitHubConfig workspaceId={workspace.id} spaces={spaces} connected={connected} connection={connection} stats={stats} />
          ) : (
            <LinearConfig connected={connected} connectionError={connection?.last_error ?? null} />
          )}
        </div>
      </div>
    </>
  );
}

function GitHubConfig({
  workspaceId,
  spaces,
  connected,
  connection,
  stats,
}: {
  workspaceId: string;
  spaces: Space[];
  connected: boolean;
  connection: Awaited<ReturnType<typeof getIntegrationConnection>>;
  stats: GitHubPolicyStats | null;
}) {
  const defaultSpaceId = connection?.default_space_id ?? spaces.find((space) => space.name === "Engineering")?.id ?? spaces[0]?.id ?? "";
  const autoApprove = connection ? isAutoApproveEnabled(connection) : true;
  const repos = Array.isArray(connection?.metadata.repositories)
    ? (connection.metadata.repositories as { full_name: string }[])
    : [];

  return (
    <>
      {/* 25b policy hero — the one decision this page exists for. */}
      <SettingsCard
        title="Auto-approve policy"
        sub="A merged PR was already reviewed in GitHub, so Aqli publishes its doc directly as Approved — live context for agents immediately. Turn this off to route PR-sourced docs through the Review Queue instead."
        action={connected ? <AutoApprovePolicyToggle workspaceId={workspaceId} enabled={autoApprove} /> : undefined}
      >
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            <StatCell
              label="Auto-approved this quarter"
              value={String(stats.autoApprovedThisQuarter)}
              hint="doc updates published without a second review"
            />
            <StatCell
              label="Docs touched this quarter"
              value={String(stats.docsTouchedThisQuarter)}
              hint="distinct docs created or patched from PRs"
            />
            <StatCell
              label="Median PR → doc latency"
              value={formatLatency(stats.medianLatencyMs)}
              hint="merge to published doc"
              last
            />
          </div>
        )}
        <ReadOnlyRow label="Matched PR" value={`Patch the linked doc's What's implemented section${autoApprove ? " and approve it (live context immediately)." : " and send it to the Review Queue."}`} />
        <ReadOnlyRow label="Unmatched PR" value={`Create a new Fix Note in the default destination space${autoApprove ? " and approve it." : " for review."}`} />
      </SettingsCard>

      <SettingsCard title="Connection" sub="Use a GitHub account with access to the repositories Aqli should watch.">
        <ConnectionStatus connected={connected} error={connection?.last_error ?? null} />

        {connected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <GitHubRepoPicker
              workspaceId={workspaceId}
              spaces={spaces.map((s) => ({ id: s.id, name: s.name }))}
              defaultSpaceId={defaultSpaceId}
            />
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <GitHubTokenForm workspaceId={workspaceId} connected />
            </div>
          </div>
        ) : (
          <GitHubTokenForm workspaceId={workspaceId} connected={false} />
        )}
      </SettingsCard>

      {connected && repos.length > 0 && stats && (
        <SettingsCard title="Watched repositories" sub="Merged PRs on these repositories create or update docs.">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                <th style={{ fontWeight: 600, padding: "0 0 8px" }}>Repository</th>
                <th style={{ fontWeight: 600, padding: "0 0 8px" }}>PR events</th>
                <th style={{ fontWeight: 600, padding: "0 0 8px" }}>Docs touched</th>
                <th style={{ fontWeight: 600, padding: "0 0 8px" }}>Last event</th>
              </tr>
            </thead>
            <tbody>
              {repos.map((repo) => {
                const stat = stats.repoStats.get(repo.full_name);
                return (
                  <tr key={repo.full_name} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 0", color: "var(--text-primary)", fontWeight: 500, fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{repo.full_name}</td>
                    <td style={{ padding: "10px 0", color: "var(--text-secondary)" }}>{stat?.events ?? 0}</td>
                    <td style={{ padding: "10px 0", color: "var(--text-secondary)" }}>{stat?.docs_touched ?? 0}</td>
                    <td style={{ padding: "10px 0", color: "var(--text-muted)" }}>{stat?.last_event_at ? formatRelative(stat.last_event_at) : "No events yet"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </SettingsCard>
      )}
    </>
  );
}

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return "<1s";
  const secs = Math.round(ms / 1000);
  if (secs < 90) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 90) return `${mins}m`;
  return `${Math.round(mins / 60)}h`;
}

function LinearConfig({
  connected,
  connectionError,
}: {
  connected: boolean;
  connectionError: string | null;
}) {
  return (
    <SettingsCard title="Connection" sub="Linear is preferred context for PR matching, but PRs without tickets still create review docs.">
      <ConnectionStatus
        connected={connected}
        error={connectionError}
        idle="Linear connections are unavailable."
        connectedText="Connected, but no longer enriching — see below."
      />
      {/*
        Linear ran entirely on Composio's toolkit and had no direct
        implementation to swap in when the SDK was removed. Rather than leave a
        Connect button that posts to a route which no longer exists, say so.

        A PR mentioning ABC-123 still has its key extracted and matched against
        existing docs; what is gone is pulling the issue's title and description
        into the generated text. Restoring it needs a Linear API token of its
        own — `lib/integrations/linear.ts` already parses the URLs.
      */}
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        Connecting Linear needed a third-party service that Aqli no longer depends on. Pull
        requests that mention an issue key are still matched to the right doc — only the issue
        title and description are missing from the summary.
      </p>
    </SettingsCard>
  );
}

function ConnectionStatus({
  connected,
  error,
  connectedText = "Connected with a personal access token.",
  idle = "Not connected. Paste a GitHub token to start watching repositories.",
}: {
  connected: boolean;
  error: string | null;
  connectedText?: string;
  idle?: string;
}) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: error ? "#993C1D" : "var(--text-secondary)" }}>
      {error ?? (connected ? connectedText : idle)}
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 16, padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{label}</span>
      <span style={{ color: "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}

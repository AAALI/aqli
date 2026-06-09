import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import { getIntegrationConnection } from "@/lib/supabase/integration-connections";
import AppTopBar from "@/components/layout/AppTopBar";
import { SettingsCard, SettingsHeader } from "@/components/settings/primitives";
import { providerLogo } from "@/components/settings/BrandLogos";
import GitHubRepoPicker from "@/components/integrations/GitHubRepoPicker";
import { IconChevLeft } from "@/components/aqli/icons";
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
  const [spaces, connection] = await Promise.all([
    getSpaces(workspace.id),
    // Let real failures (auth, DB) surface so users aren't shown a misleading
    // "disconnected" state during outages or permission regressions.
    getIntegrationConnection(workspace.id, provider),
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
            <GitHubConfig workspaceId={workspace.id} workspaceSlug={workspace.slug} spaces={spaces} connected={connected} connection={connection} />
          ) : (
            <LinearConfig workspaceId={workspace.id} workspaceSlug={workspace.slug} connected={connected} connectionError={connection?.last_error ?? null} />
          )}
        </div>
      </div>
    </>
  );
}

function GitHubConfig({
  workspaceId,
  workspaceSlug,
  spaces,
  connected,
  connection,
}: {
  workspaceId: string;
  workspaceSlug: string;
  spaces: Space[];
  connected: boolean;
  connection: Awaited<ReturnType<typeof getIntegrationConnection>>;
}) {
  const defaultSpaceId = connection?.default_space_id ?? spaces.find((space) => space.name === "Engineering")?.id ?? spaces[0]?.id ?? "";

  return (
    <>
      <SettingsCard title="Connection" sub="Use a GitHub account with access to the repositories Aqli should watch.">
        <ConnectionStatus connected={connected} error={connection?.last_error ?? null} />

        {connected ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <GitHubRepoPicker
              workspaceId={workspaceId}
              spaces={spaces.map((s) => ({ id: s.id, name: s.name }))}
              defaultSpaceId={defaultSpaceId}
            />
            <form method="post" action="/api/integrations/composio/connect" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <input type="hidden" name="__form" value="true" />
              <input type="hidden" name="provider" value="github" />
              <input type="hidden" name="workspace_id" value={workspaceId} />
              <input type="hidden" name="workspace_slug" value={workspaceSlug} />
              <button className="btn btn-secondary" style={{ width: "fit-content" }}>Reconnect GitHub</button>
            </form>
          </div>
        ) : (
          <form method="post" action="/api/integrations/composio/connect">
            <input type="hidden" name="__form" value="true" />
            <input type="hidden" name="provider" value="github" />
            <input type="hidden" name="workspace_id" value={workspaceId} />
            <input type="hidden" name="workspace_slug" value={workspaceSlug} />
            <button className="btn btn-primary" style={{ width: "fit-content" }}>Connect GitHub</button>
          </form>
        )}
      </SettingsCard>

      <SettingsCard title="What happens on merge" sub="A merged PR is already reviewed in GitHub, so doc updates are trusted automatically — no second review.">
        <ReadOnlyRow label="Matched PR" value="Patch the linked doc's What's implemented section and approve it (live context immediately)." />
        <ReadOnlyRow label="Unmatched PR" value="Create a new Fix Note in the default destination space and approve it." />
      </SettingsCard>
    </>
  );
}

function LinearConfig({
  workspaceId,
  workspaceSlug,
  connected,
  connectionError,
}: {
  workspaceId: string;
  workspaceSlug: string;
  connected: boolean;
  connectionError: string | null;
}) {
  return (
    <SettingsCard title="Connection" sub="Linear is preferred context for PR matching, but PRs without tickets still create review docs.">
      <ConnectionStatus connected={connected} error={connectionError} />
      <form method="post" action="/api/integrations/composio/connect">
        <input type="hidden" name="__form" value="true" />
        <input type="hidden" name="provider" value="linear" />
        <input type="hidden" name="workspace_id" value={workspaceId} />
        <input type="hidden" name="workspace_slug" value={workspaceSlug} />
        <button className="btn btn-primary">{connected ? "Reconnect Linear" : "Connect Linear"}</button>
      </form>
    </SettingsCard>
  );
}

function ConnectionStatus({ connected, error }: { connected: boolean; error: string | null }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-base)", fontSize: 13, color: error ? "#993C1D" : "var(--text-secondary)" }}>
      {error ?? (connected ? "Connected through Composio." : "Not connected. Click connect to start Composio OAuth.")}
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

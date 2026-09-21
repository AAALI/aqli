import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { listIntegrationConnections } from "@/lib/supabase/integration-connections";
import { getGitHubPolicyStats } from "@/lib/supabase/github-stats";
import { getSpaces } from "@/lib/supabase/spaces";
import { isAutoApproveEnabled } from "@/lib/integrations/source/policy";
import AppTopBar from "@/components/layout/AppTopBar";
import { providerLogo } from "@/components/settings/BrandLogos";
import { formatRelative } from "@/lib/utils";
import type { IntegrationConnection } from "@/types/integration";

/**
 * Settings · Integrations (v3 §5.18, frame 18). Was a provider grid. Each
 * connection now says what it actually writes into the workspace — the thing
 * an admin needs to know — rather than only that it is available.
 */
export default async function SettingsIntegrationsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  // Let auth/DB failures surface — silently rendering "no integrations"
  // misleads admins during outages or permission regressions.
  const [connections, spaces] = await Promise.all([
    listIntegrationConnections(workspace.id),
    getSpaces(workspace.id).catch(() => []),
  ]);
  const base = `/w/${workspace.slug}`;
  const s = `${base}/settings`;
  const github = connections.find((c) => c.provider === "github" && c.status === "connected");
  const linear = connections.find((c) => c.provider === "linear" && c.status === "connected");
  const stats = github ? await getGitHubPolicyStats(workspace.id).catch(() => null) : null;
  const spaceName = (id: string | null | undefined) => spaces.find((sp) => sp.id === id)?.name ?? "Engineering";

  const available = [
    ...(!github ? [{ href: `${s}/integrations/github`, name: "GitHub", line: "Write a fix note into a space every time a PR merges." }] : []),
    ...(!linear ? [{ href: `${s}/integrations/linear`, name: "Linear", line: "Match merged PRs to the doc their issue belongs to." }] : []),
    { href: `${s}/import`, name: "Notion", line: "One-way import, links and headings intact." },
    { href: `${s}/import`, name: "Confluence", line: "One-way import, per space." },
  ];

  return (
    <>
      <AppTopBar crumbs={[{ label: "Settings", href: s }, { label: "Integrations" }]} />
      <div className="wrap">
        <div style={{ maxWidth: 700 }}>
          <h1 className="h1">Integrations</h1>
          <p className="h1s">Each one is a source of truth Aqli can watch. Nothing writes to your docs without saying so on the page.</p>

          {(github || linear) && (
            <section className="sect">
              <div className="sect-h"><h2>Connected</h2></div>
              {github && (
                <Connection
                  logo={providerLogo("github", 34)}
                  name="GitHub"
                  href={`${s}/integrations/github`}
                  says={
                    <>
                      Watching {repoCount(github)} repo{repoCount(github) === 1 ? "" : "s"}. When a PR merges, Aqli writes a fix note into{" "}
                      <b style={{ fontWeight: 600 }}>{spaceName(github.default_space_id)}</b>{" "}
                      {isAutoApproveEnabled(github) ? "and publishes it under whoever merged it." : "and sends it to Checks."}
                    </>
                  }
                  numbers={[
                    stats ? `${stats.docsTouchedThisQuarter} doc${stats.docsTouchedThisQuarter === 1 ? "" : "s"} written this quarter` : null,
                    stats?.medianLatencyMs ? `median ${Math.round(stats.medianLatencyMs / 1000)}s from merge to doc` : null,
                    github.last_event_at ? `last one ${formatRelative(github.last_event_at)}` : null,
                  ]}
                  error={github.last_error}
                />
              )}
              {linear && (
                <Connection
                  logo={providerLogo("linear", 34)}
                  name="Linear"
                  href={`${s}/integrations/linear`}
                  says={<>Reads issues and projects so a merged PR updates the doc its issue belongs to, instead of starting a new one.</>}
                  numbers={[linear.last_event_at ? `last used ${formatRelative(linear.last_event_at)}` : null]}
                  error={linear.last_error}
                />
              )}
            </section>
          )}

          <section className="sect">
            <div className="sect-h"><h2>Available</h2></div>
            <div className="grid3">
              {available.map((a) => (
                <Link key={a.name} href={a.href} className="tpl">
                  <b>{a.name}</b>
                  <span>{a.line}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function Connection({
  logo,
  name,
  href,
  says,
  numbers,
  error,
}: {
  logo: React.ReactNode;
  name: string;
  href: string;
  says: React.ReactNode;
  numbers: (string | null)[];
  error: string | null | undefined;
}) {
  const facts = numbers.filter(Boolean).join(" · ");
  return (
    <div className="card" style={{ display: "flex", gap: 15, alignItems: "flex-start", padding: "18px 20px", marginTop: 12 }}>
      <span style={{ display: "flex", flex: "0 0 34px" }}>{logo}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 500 }}>{name}</b>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{says}</p>
        {(facts || error) && (
          <p style={{ margin: "9px 0 0", fontSize: 12.5, color: error ? "var(--ageing-text)" : "var(--text-muted)" }}>{error ?? facts}</p>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "flex-end" }}>
        <span className={`tl ${error ? "tl-ageing" : "tl-current"}`}>
          <i aria-hidden />
          {error ? "Needs a look" : "Active"}
        </span>
        <Link href={href} className="btn btn-sm btn-ghost">Configure</Link>
      </div>
    </div>
  );
}

function repoCount(c: IntegrationConnection): number {
  return Array.isArray(c.metadata?.repositories) ? c.metadata.repositories.length : 0;
}

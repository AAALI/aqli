import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import AppTopBar from "@/components/layout/AppTopBar";
import { SettingsHeader, StatCell } from "@/components/settings/primitives";
import { providerLogo } from "@/components/settings/BrandLogos";
import { IconDots, IconArrowUpRight, IconBook } from "@/components/aqli/icons";

type Item = {
  id: string;
  name: string;
  desc: string;
  status: "connected" | "available";
  meta: string;
  actor?: { name: string; initial: string; cls: string };
  badge?: string;
};

const INTEGRATIONS: Item[] = [
  { id: "linear", name: "Linear", desc: "Link docs to projects and issues. Detect Linear URLs in doc bodies and show inline previews.", status: "connected", meta: "Tabadulat workspace · 3 projects synced · auto-detect URLs on", actor: { name: "Ali", initial: "A", cls: "avatar-ali" } },
  { id: "slack", name: "Slack", desc: "Post notifications to a channel: review requests, approvals, stale-doc alerts.", status: "connected", meta: "Tabadulat workspace · #doc-review · 4 event types", actor: { name: "Sara", initial: "S", cls: "avatar-sara" } },
  { id: "github", name: "GitHub", desc: "Mirror docs to a repo as Markdown. Agents can commit alongside Aqli writes.", status: "available", meta: "Lets you keep a Git-native copy of your knowledge base." },
  { id: "mcp", name: "MCP server", desc: "Expose your Aqli context to any MCP-compatible agent natively, without an API key.", status: "available", meta: "Recommended if you use Claude Desktop, Zed, or Cursor's MCP support.", badge: "New" },
];

export default async function SettingsIntegrationsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;
  const settingsBase = `${base}/settings`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: settingsBase }, { label: "Integrations" }]} />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <SettingsHeader
            title="Integrations"
            sub="Connect Aqli to the tools your team already uses. Each integration is workspace-scoped and can be revoked at any time."
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 26, overflow: "hidden" }}>
            <StatCell label="Connected" value="2" />
            <StatCell label="URLs auto-detected" value="38" hint="across 12 docs" />
            <StatCell label="Slack posts · 7d" value="14" hint="review requests + approvals" />
            <StatCell label="Most recent" value="Linear" hint="Jun 1 · TAB-441" last />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {INTEGRATIONS.map((it) => <IntegrationCard key={it.id} it={it} settingsBase={settingsBase} />)}
          </div>

          <div style={{ marginTop: 28, padding: "16px 20px", background: "var(--bg-sidebar)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 28, height: 28, borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              <IconBook size={14} />
            </span>
            <div style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Want an integration that isn&apos;t here? Aqli&apos;s storage layer can be swapped to <strong style={{ color: "var(--text-primary)", fontWeight: 500 }}>GitHub, Supabase, or local Postgres</strong> via the .env config. See self-hosting docs.
            </div>
            <span style={{ color: "var(--text-secondary)", display: "flex" }}><IconArrowUpRight size={14} /></span>
          </div>
        </div>
      </div>
    </>
  );
}

function IntegrationCard({ it, settingsBase }: { it: Item; settingsBase: string }) {
  const detailHref = `${settingsBase}/integrations/${it.id}`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 18, alignItems: "center", padding: "20px 22px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10 }}>
      {providerLogo(it.id, 36)}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.005em" }}>{it.name}</span>
          {it.status === "connected" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 22, padding: "0 8px", borderRadius: 6, background: "var(--approved-bg)", color: "var(--approved-text)", border: "1px solid var(--approved-border)", fontSize: 11.5, fontWeight: 500 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
              Connected
            </span>
          )}
          {it.badge && (
            <span style={{ height: 22, padding: "0 8px", borderRadius: 6, background: "var(--accent-light)", color: "var(--accent)", border: "1px solid rgba(15,110,86,0.25)", fontSize: 11.5, fontWeight: 500, display: "inline-flex", alignItems: "center" }}>{it.badge}</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{it.desc}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
          {it.status === "connected" && it.actor && (
            <>
              <span className={`avatar avatar-sm ${it.actor.cls}`} style={{ width: 18, height: 18, fontSize: 9 }}>{it.actor.initial}</span>
              <span>Connected by {it.actor.name}</span>
              <span>·</span>
            </>
          )}
          <span>{it.meta}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {it.status === "connected" ? (
          <>
            <Link href={detailHref} className="btn btn-secondary">Configure</Link>
            <span style={{ color: "var(--text-muted)", cursor: "pointer", padding: 4 }}><IconDots size={16} /></span>
          </>
        ) : (
          <Link href={detailHref} className="btn btn-primary">
            <span>Connect</span>
            <IconArrowUpRight size={12} />
          </Link>
        )}
      </div>
    </div>
  );
}

export { INTEGRATIONS };
export type { Item as IntegrationItem };

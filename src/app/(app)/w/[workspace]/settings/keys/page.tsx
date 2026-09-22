import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import { getSpaces } from "@/lib/supabase/spaces";
import { listApiKeys } from "@/lib/api-keys";
import { getIntegrationConnection } from "@/lib/supabase/integration-connections";
import { isAutoApproveEnabled } from "@/lib/integrations/source/policy";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppTopBar from "@/components/layout/AppTopBar";
import KeysClient from "./KeysClient";
import Rules from "./Rules";

/**
 * Settings · AI access (v3 §5.10, frame 10). Where onboarding's old fourth
 * step went: optional, findable, and in nobody's way.
 *
 * It also absorbs the deleted /agent-log: each key says how many docs its
 * agent has written, and the drafts themselves arrive in Checks.
 */
export default async function SettingsKeysPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;
  const supabase = await createServerSupabaseClient();

  const [role, keys, spaces, github, { data: revs }] = await Promise.all([
    getMyRole(workspace.id),
    listApiKeys(workspace.id),
    getSpaces(workspace.id).catch(() => []),
    getIntegrationConnection(workspace.id, "github").catch(() => null),
    supabase.from("revisions").select("agent_key_id").eq("workspace_id", workspace.id).not("agent_key_id", "is", null),
  ]);
  const wrote = new Map<string, number>();
  for (const r of (revs ?? []) as { agent_key_id: string }[]) wrote.set(r.agent_key_id, (wrote.get(r.agent_key_id) ?? 0) + 1);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const openSpaces = spaces.filter((s) => s.review_policy === "open");
  const reviewedSpaces = spaces.filter((s) => s.review_policy === "review_agents");
  const repos = Array.isArray(github?.metadata?.repositories) ? (github.metadata.repositories as unknown[]).length : 0;

  return (
    <>
      <AppTopBar crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "AI access" }]} />
      <KeysClient
        workspaceId={workspace.id}
        appUrl={appUrl}
        canManage={role === "admin"}
        initialKeys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          key_prefix: k.key_prefix,
          last_used_at: k.last_used_at,
          created_at: k.created_at,
          scopes: k.scopes ?? [],
          wrote: wrote.get(k.id) ?? 0,
          active: usedThisMonth(k.last_used_at),
        }))}
        rules={
          <Rules
            workspaceId={workspace.id}
            isAdmin={role === "admin"}
            confirmAgentDrafts={openSpaces.length === 0}
            openSpaceIds={openSpaces.map((s) => s.id)}
            reviewedSpaceIds={reviewedSpaces.map((s) => s.id)}
            githubConnected={github?.status === "connected"}
            prSelfPublish={github ? isAutoApproveEnabled(github) : true}
            prAside={repos ? `${repos} repo${repos === 1 ? "" : "s"} watched` : undefined}
          />
        }
      />
    </>
  );
}

/** Active means used in the last month; a key nobody has used is Idle. */
function usedThisMonth(iso: string | null): boolean {
  return Boolean(iso && Date.now() - Date.parse(iso) < 30 * 86_400_000);
}

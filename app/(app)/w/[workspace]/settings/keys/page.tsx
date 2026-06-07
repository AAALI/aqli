import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import { listApiKeys } from "@/lib/api-keys";
import AppTopBar from "@/components/layout/AppTopBar";
import KeysClient from "./KeysClient";

export default async function SettingsKeysPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;

  const [role, keys] = await Promise.all([
    getMyRole(workspace.id),
    listApiKeys(workspace.id),
  ]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "API keys" }]} />
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
        }))}
      />
    </div>
  );
}

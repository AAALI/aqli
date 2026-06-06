import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
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

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "API keys" }]} />
      <KeysClient />
    </div>
  );
}

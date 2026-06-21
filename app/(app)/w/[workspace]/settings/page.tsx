import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import AppTopBar from "@/components/layout/AppTopBar";
import SettingsGeneralClient from "./SettingsGeneralClient";

export default async function SettingsGeneralPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const role = await getMyRole(workspace.id);
  const base = `/w/${workspace.slug}`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Workspace" }]} />
      <div className="content" style={{ padding: "32px 44px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <SettingsGeneralClient workspace={workspace} isAdmin={role === "admin"} />
        </div>
      </div>
    </>
  );
}

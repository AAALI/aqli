import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import { getSpaces } from "@/lib/supabase/spaces";
import AppTopBar from "@/components/layout/AppTopBar";
import SpacePoliciesClient from "./SpacePoliciesClient";

export default async function SettingsSpacesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;

  const [role, spaces] = await Promise.all([
    getMyRole(workspace.id),
    getSpaces(workspace.id),
  ]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <AppTopBar
        base={base}
        crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Spaces" }]}
      />
      <SpacePoliciesClient
        canManage={role === "admin"}
        initialSpaces={spaces.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          icon: s.icon,
          review_policy: s.review_policy,
        }))}
      />
    </div>
  );
}

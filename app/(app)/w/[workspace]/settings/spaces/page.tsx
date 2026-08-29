import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole, listWorkspaceMembers } from "@/lib/supabase/members";
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

  const [role, spaces, members] = await Promise.all([
    getMyRole(workspace.id),
    getSpaces(workspace.id),
    // For the private-space roster. Cheap, and the alternative is a second
    // round trip the moment anyone opens one.
    listWorkspaceMembers(workspace.id).catch(() => []),
  ]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <AppTopBar
        base={base}
        crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Spaces" }]}
      />
      <SpacePoliciesClient
        canManage={role === "admin"}
        workspaceMembers={members.map((m) => ({
          user_id: m.user_id,
          email: m.email,
          full_name: m.full_name,
        }))}
        initialSpaces={spaces.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          icon: s.icon,
          review_policy: s.review_policy,
          visibility: s.visibility ?? "open",
        }))}
      />
    </div>
  );
}

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole, listWorkspaceMembers } from "@/lib/supabase/members";
import { listPendingInvitations } from "@/lib/supabase/invitations";
import AppTopBar from "@/components/layout/AppTopBar";
import MembersClient from "./MembersClient";

export default async function SettingsMembersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: wsSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const base = `/w/${workspace.slug}`;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [role, members] = await Promise.all([
    getMyRole(workspace.id),
    listWorkspaceMembers(workspace.id),
  ]);
  const isAdmin = role === "admin";

  // Pending invitations are admin-only (RLS returns nothing otherwise).
  const invitations = isAdmin
    ? await listPendingInvitations(workspace.id).catch(() => [])
    : [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <AppTopBar base={base} crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "Members" }]} />
      <MembersClient
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        appUrl={appUrl}
        canManage={isAdmin}
        currentUserId={user?.id ?? null}
        initialMembers={members}
        initialInvitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          token: i.token,
          created_at: i.created_at,
          expires_at: i.expires_at,
        }))}
      />
    </div>
  );
}

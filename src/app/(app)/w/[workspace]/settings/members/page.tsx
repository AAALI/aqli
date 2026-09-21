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

  const [role, members, { data: owned }] = await Promise.all([
    getMyRole(workspace.id),
    listWorkspaceMembers(workspace.id),
    supabase.from("docs").select("owner_id").eq("workspace_id", workspace.id).neq("status", "draft"),
  ]);
  const owns = new Map<string, number>();
  for (const d of (owned ?? []) as { owner_id: string | null }[]) {
    if (d.owner_id) owns.set(d.owner_id, (owns.get(d.owner_id) ?? 0) + 1);
  }
  const isAdmin = role === "admin";

  // Pending invitations are admin-only (RLS returns nothing otherwise).
  const invitations = isAdmin
    ? await listPendingInvitations(workspace.id).catch(() => [])
    : [];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <>
      <AppTopBar crumbs={[{ label: "Settings", href: `${base}/settings` }, { label: "People" }]} />
      <MembersClient
        workspaceId={workspace.id}
        appUrl={appUrl}
        canManage={isAdmin}
        currentUserId={user?.id ?? null}
        initialMembers={members.map((m) => ({ ...m, owns: owns.get(m.user_id) ?? 0 }))}
        initialInvitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          token: i.token,
          created_at: i.created_at,
          expires_at: i.expires_at,
          expiresInDays: daysUntil(i.expires_at),
        }))}
      />
    </>
  );
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000));
}

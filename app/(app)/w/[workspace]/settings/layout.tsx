import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getMyRole } from "@/lib/supabase/members";
import SettingsSidebar from "@/components/layout/SettingsSidebar";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug).catch(() => null);
  if (!workspace) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "You";

  const role = await getMyRole(workspace.id);
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Member";

  const base = `/w/${workspace.slug}`;

  return (
    <>
      <SettingsSidebar base={base} workspaceName={workspace.name} userName={userName} roleLabel={roleLabel} />
      <div className="main">{children}</div>
    </>
  );
}

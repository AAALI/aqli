import { notFound } from "next/navigation";
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

  const role = await getMyRole(workspace.id);

  const base = `/w/${workspace.slug}`;

  return (
    <>
      <SettingsSidebar base={base} workspaceName={workspace.name} isAdmin={role === "admin"} />
      <div className="main">{children}</div>
    </>
  );
}

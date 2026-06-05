import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceBySlug(slug).catch(() => null);
  if (!workspace) notFound();

  const spaces = await getSpaces(workspace.id);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        workspaceSlug={workspace.slug}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        spaces={spaces}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar workspaceSlug={workspace.slug} userEmail={user.email} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

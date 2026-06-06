import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import Sidebar from "@/components/layout/Sidebar";

export default async function MainShell({
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

  const spaces = await getSpaces(workspace.id);
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "You";

  return (
    <>
      <Sidebar
        workspaceSlug={workspace.slug}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        spaces={spaces}
        userName={userName}
      />
      <div className="main">{children}</div>
    </>
  );
}

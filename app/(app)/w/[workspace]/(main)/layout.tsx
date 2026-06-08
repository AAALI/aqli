import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import { getReviewCount } from "@/lib/supabase/review";
import { getStaleCount } from "@/lib/supabase/stale";
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

  const [spaces, reviewCount, staleCount] = await Promise.all([
    getSpaces(workspace.id),
    getReviewCount(workspace.id),
    getStaleCount(workspace.id),
  ]);
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
        reviewCount={reviewCount}
        staleCount={staleCount}
      />
      <div className="main">{children}</div>
    </>
  );
}

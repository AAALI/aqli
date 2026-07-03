import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import { getDocs } from "@/lib/supabase/docs";
import CommandPalette from "@/components/cmdk/CommandPalette";
import AqliChatWidget from "@/components/ai/AqliChatWidget";

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

  const [spaces, recentDocs] = await Promise.all([
    getSpaces(workspace.id),
    getDocs(workspace.id, { limit: 6 }),
  ]);

  return (
    <div className="aqli-screen is-app">
      {children}
      <CommandPalette
        workspaceSlug={workspace.slug}
        workspaceId={workspace.id}
        spaces={spaces.map((s) => ({ id: s.id, name: s.name, slug: s.slug, icon: s.icon }))}
        recentDocs={recentDocs.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          status: d.status,
          space_id: d.space_id,
        }))}
      />
      <AqliChatWidget workspaceId={workspace.id} workspaceSlug={workspace.slug} />
    </div>
  );
}

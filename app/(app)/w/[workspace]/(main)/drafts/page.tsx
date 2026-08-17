import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getDocs } from "@/lib/supabase/docs";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import DocList from "@/components/docs/DocList";
import AppTopBar from "@/components/layout/AppTopBar";
import { PageHeader, EmptyState, Eyebrow } from "@/components/aqli/page";

export default async function DraftsPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [allDrafts, owners] = await Promise.all([
    getDocs(workspace.id, { status: "draft", limit: 200 }),
    getOwnerDirectory(workspace.id),
  ]);
  const mine = user ? allDrafts.filter((d) => d.owner_id === user.id) : [];
  const others = allDrafts.filter((d) => !mine.includes(d));
  const base = `/w/${workspace.slug}`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: "Drafts" }]} />
      <div className="content" style={{ padding: "28px 40px", overflowY: "auto" }}>
        <div className="page-col">
          <PageHeader
            eyebrow="In flight"
            title="Drafts"
            sub="Work that hasn't been through review yet — yours first, then everyone else's."
          />

          {allDrafts.length === 0 ? (
            <EmptyState title="No drafts in this workspace">
              Every new doc starts life here and stays until it goes for review.
            </EmptyState>
          ) : (
            <>
              {mine.length > 0 ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Eyebrow>Yours</Eyebrow>
                  </div>
                  <DocList docs={mine} workspaceSlug={workspace.slug} emptyLabel="" owners={owners} />
                </>
              ) : (
                <EmptyState title="Nothing in flight from you">
                  Drafts you start will collect here. Others&apos; are below.
                </EmptyState>
              )}
              {others.length > 0 && (
                <>
                  <div style={{ marginTop: 28, marginBottom: 12 }}>
                    <Eyebrow>Elsewhere in the workspace</Eyebrow>
                  </div>
                  <DocList docs={others} workspaceSlug={workspace.slug} emptyLabel="" owners={owners} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

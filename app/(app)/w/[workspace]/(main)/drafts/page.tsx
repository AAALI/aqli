import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getDocs } from "@/lib/supabase/docs";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import DocList from "@/components/docs/DocList";
import AppTopBar from "@/components/layout/AppTopBar";

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
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 4px", fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, letterSpacing: "-0.015em" }}>
            Drafts
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "var(--text-secondary)" }}>
            Your in-flight work — pick up where you left off.
          </p>

          {allDrafts.length === 0 ? (
            <DocList docs={[]} workspaceSlug={workspace.slug} emptyLabel="No drafts yet. New docs start here before review." />
          ) : (
            <>
              <SubHead label={mine.length > 0 ? "Yours" : "No drafts owned by you"} />
              {mine.length > 0 && (
                <DocList docs={mine} workspaceSlug={workspace.slug} emptyLabel="" owners={owners} />
              )}
              {others.length > 0 && (
                <>
                  <div style={{ marginTop: mine.length > 0 ? 28 : 0 }}>
                    <SubHead label="Elsewhere in the workspace" />
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

function SubHead({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        marginBottom: 12,
      }}
    >
      {label}
    </div>
  );
}

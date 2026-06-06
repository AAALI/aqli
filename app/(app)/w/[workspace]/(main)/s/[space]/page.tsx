import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaceBySlug } from "@/lib/supabase/spaces";
import { getDocs } from "@/lib/supabase/docs";
import DocList from "@/components/docs/DocList";
import AppTopBar from "@/components/layout/AppTopBar";
import { SpaceHeader } from "@/components/aqli/SpaceHeader";
import { IconPlus } from "@/components/aqli/icons";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ workspace: string; space: string }>;
}) {
  const { workspace: wsSlug, space: spaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const space = await getSpaceBySlug(workspace.id, spaceSlug).catch(() => null);
  if (!space) notFound();

  const docs = await getDocs(workspace.id, { spaceId: space.id, limit: 100 });
  const base = `/w/${workspace.slug}`;
  const pending = docs.filter((d) => d.status === "review").length;

  return (
    <>
      <AppTopBar
        base={base}
        crumbs={[{ label: space.name }]}
        primary={{ label: "New Doc", href: `${base}/s/${space.slug}/new` }}
      />
      <div className="content" style={{ padding: "28px 40px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <SpaceHeader
            emoji={space.icon}
            name={space.name}
            sub={`${docs.length} doc${docs.length === 1 ? "" : "s"}${pending ? ` · ${pending} pending review` : ""}`}
            filters={["All", "PRD", "ADR", "Runbook", "Fix Note"]}
          />
          {docs.length === 0 ? (
            <EmptySpace newHref={`${base}/s/${space.slug}/new`} spaceName={space.name} />
          ) : (
            <DocList docs={docs} workspaceSlug={workspace.slug} emptyLabel="No docs in this space yet." />
          )}
        </div>
      </div>
    </>
  );
}

function EmptySpace({ newHref, spaceName }: { newHref: string; spaceName: string }) {
  return (
    <div
      style={{
        border: "1px dashed var(--border-strong)",
        borderRadius: 12,
        padding: "56px 32px",
        textAlign: "center",
        background: "var(--bg-card)",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
        {spaceName} is empty
      </div>
      <p style={{ margin: "0 auto 22px", maxWidth: 380, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-secondary)" }}>
        Docs you create here become shared context — searchable by your team and queryable by your agents.
      </p>
      <Link href={newHref} className="btn btn-primary" style={{ height: 38, padding: "0 18px" }}>
        <IconPlus size={14} /> New Doc
      </Link>
    </div>
  );
}

import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import { getDocs } from "@/lib/supabase/docs";
import DocList from "@/components/docs/DocList";
import AppTopBar from "@/components/layout/AppTopBar";
import { IconPlus, IconArrowUpRight } from "@/components/aqli/icons";

export default async function WorkspaceHome({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  const [docs, spaces] = await Promise.all([
    getDocs(workspace.id, { limit: 20 }),
    getSpaces(workspace.id),
  ]);
  const base = `/w/${workspace.slug}`;
  const firstSpace = spaces[0];
  const newDocHref = firstSpace ? `${base}/s/${firstSpace.slug}/new` : `${base}`;

  return (
    <>
      <AppTopBar
        base={base}
        crumbs={[{ label: "Home" }]}
        primary={firstSpace ? { label: "New Doc", href: newDocHref } : null}
      />
      <div className="content">
        {docs.length === 0 ? (
          <EmptyWorkspace firstSpaceHref={firstSpace ? `${base}/s/${firstSpace.slug}` : base} />
        ) : (
          <div style={{ maxWidth: 920, margin: "0 auto" }}>
            <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 500, letterSpacing: "-0.015em" }}>
              {workspace.name}
            </h1>
            <p style={{ margin: "0 0 24px", fontSize: 13.5, color: "var(--text-secondary)" }}>
              Recently updated across your spaces
            </p>
            <DocList
              docs={docs}
              workspaceSlug={workspace.slug}
              emptyLabel="No docs yet. Open a space and create your first doc."
            />
          </div>
        )}
      </div>
    </>
  );
}

function EmptyWorkspace({ firstSpaceHref }: { firstSpaceHref: string }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 520, textAlign: "center" }}>
        <h1 style={{ margin: "0 0 10px", fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 36, letterSpacing: "-0.02em" }}>
          A clean slate.
        </h1>
        <p style={{ margin: "0 0 28px", fontSize: 15, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          This workspace doesn&apos;t have any docs yet. Start with a PRD, an ADR, or the
          on-call thing nobody wrote down — your agents will read it for context.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link href={`${firstSpaceHref}/new`} className="btn btn-primary" style={{ height: 38, padding: "0 18px" }}>
            <IconPlus size={14} /> Write your first doc
          </Link>
          <Link href={firstSpaceHref} className="btn btn-secondary" style={{ height: 38, padding: "0 16px" }}>
            Browse a space <IconArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

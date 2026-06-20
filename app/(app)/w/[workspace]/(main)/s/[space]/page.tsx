import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaceBySlug } from "@/lib/supabase/spaces";
import { getDocs } from "@/lib/supabase/docs";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import DocList from "@/components/docs/DocList";
import AppTopBar from "@/components/layout/AppTopBar";
import SpaceTabs from "@/components/spaces/SpaceTabs";
import ShelvesView, { type Shelf } from "@/components/spaces/ShelvesView";
import { typeLabel } from "@/lib/doc-display";
import { IconPlus } from "@/components/aqli/icons";
import type { DocWithSpace } from "@/types/doc";

export default async function SpacePage({
  params,
}: {
  params: Promise<{ workspace: string; space: string }>;
}) {
  const { workspace: wsSlug, space: spaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const space = await getSpaceBySlug(workspace.id, spaceSlug).catch(() => null);
  if (!space) notFound();

  const [docs, owners] = await Promise.all([
    getDocs(workspace.id, { spaceId: space.id, limit: 200 }),
    getOwnerDirectory(workspace.id),
  ]);
  const base = `/w/${workspace.slug}`;
  const newHref = `${base}/s/${space.slug}/new`;

  return (
    <>
      <AppTopBar base={base} crumbs={[{ label: space.name }]} primary={{ label: "New Doc", href: newHref }} />

      {docs.length === 0 ? (
        <div className="content" style={{ padding: "28px 40px" }}>
          <div style={{ maxWidth: 1040, margin: "0 auto" }}>
            <SpaceTitle icon={space.icon} name={space.name} count={0} />
            <EmptySpace newHref={newHref} spaceName={space.name} />
          </div>
        </div>
      ) : (
        <div className="content" style={{ padding: 0, overflowY: "auto" }}>
          <div style={{ padding: "32px 56px 22px", background: "var(--bg-base)" }}>
            <SpaceTitle icon={space.icon} name={space.name} count={docs.length} />
          </div>
          <SpaceTabs
            docCount={docs.length}
            shelves={
              <ShelvesView
                base={base}
                startHere={pickStartHere(docs)}
                {...buildShelves(docs)}
              />
            }
            list={<DocList docs={docs} workspaceSlug={workspace.slug} emptyLabel="No docs in this space yet." owners={owners} />}
          />
        </div>
      )}
    </>
  );
}

// ── Shelf assembly ────────────────────────────────────────────────────

/** Up to three approved docs (most recently updated) as canonical entry points. */
function pickStartHere(docs: DocWithSpace[]): DocWithSpace[] {
  return docs.filter((d) => d.status === "approved").slice(0, 3);
}

/**
 * Cluster docs into shelves by tag (subject matter). If no doc carries tags,
 * fall back to grouping by doc type so the view is still meaningful.
 */
function buildShelves(docs: DocWithSpace[]): { shelves: Shelf[]; shelfBasis: "topic" | "type" } {
  const byTag = new Map<string, DocWithSpace[]>();
  for (const d of docs) {
    for (const tag of d.frontmatter?.tags ?? []) {
      if (!byTag.has(tag)) byTag.set(tag, []);
      byTag.get(tag)!.push(d);
    }
  }

  if (byTag.size > 0) {
    const shelves: Shelf[] = [...byTag.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, shelfDocs]) => ({ name, docs: shelfDocs }));
    const untagged = docs.filter((d) => !(d.frontmatter?.tags?.length));
    if (untagged.length > 0) shelves.push({ name: "Untagged", docs: untagged });
    return { shelves, shelfBasis: "topic" };
  }

  const byType = new Map<string, DocWithSpace[]>();
  for (const d of docs) {
    const key = typeLabel(d.type);
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(d);
  }
  const shelves: Shelf[] = [...byType.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, shelfDocs]) => ({ name, docs: shelfDocs }));
  return { shelves, shelfBasis: "type" };
}

// ── Header / empty ────────────────────────────────────────────────────

function SpaceTitle({ icon, name, count }: { icon: string; name: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: "var(--accent-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          flex: "0 0 56px",
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            marginBottom: 4,
          }}
        >
          Space
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontSize: 36,
            fontWeight: 400,
            letterSpacing: "-0.012em",
            color: "var(--text-primary)",
          }}
        >
          {name}
        </h1>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
          {count} doc{count === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}

function EmptySpace({ newHref, spaceName }: { newHref: string; spaceName: string }) {
  return (
    <div
      style={{
        marginTop: 24,
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

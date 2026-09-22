import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaceBySlug } from "@/lib/supabase/spaces";
import { getDocs, getSpaceTree } from "@/lib/supabase/docs";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import { getMyRole } from "@/lib/supabase/members";
import { readingPathProgress } from "@/lib/supabase/questions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppTopBar from "@/components/layout/AppTopBar";
import DocTree from "@/components/docs/DocTree";
import Status from "@/components/docs/Status";
import SpaceIcon from "@/components/aqli/SpaceIcon";
import CurateShelves from "@/components/spaces/CurateShelves";
import { docState, isPublished, type DocState } from "@/lib/doc-status";
import { typeLabel } from "@/lib/doc-display";
import { formatRelative } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

/**
 * A space is a library (v3 §5.8, frame 08): a health bar, the docs to start
 * with, a reading path for newcomers, and topic shelves. Not a filterable
 * table of PRDs and ADRs.
 *
 * The one filter is Ageing — "Show what needs a look" — which is where the
 * deleted /stale dashboard's job went: the state travels with the doc, and
 * this chip gathers the ones that have drifted in this space.
 */
export default async function SpacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; space: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { workspace: wsSlug, space: spaceSlug } = await params;
  const { show } = await searchParams;
  const workspace = await getWorkspaceBySlug(wsSlug);
  const space = await getSpaceBySlug(workspace.id, spaceSlug).catch(() => null);
  if (!space) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [all, owners, tree, role] = await Promise.all([
    getDocs(workspace.id, { spaceId: space.id, limit: 300 }),
    getOwnerDirectory(workspace.id),
    getSpaceTree(workspace.id, space.id),
    getMyRole(workspace.id),
  ]);

  // A draft is a place, and it is yours: nothing unpublished is on the shelf.
  const docs = all.filter((d) => isPublished(d.status) && d.status !== "archived");
  const byId = new Map(docs.map((d) => [d.id, d]));
  const base = `/w/${workspace.slug}`;
  const writeHref = `${base}/write?space=${space.slug}`;
  const canCurate = role === "admin" || role === "editor";
  const nameOf = (id: string | null) =>
    id ? (id === user?.id ? "you" : (owners[id]?.name ?? "a teammate")) : null;

  const states = new Map<string, DocState>(docs.map((d) => [d.id, docState(d)]));
  const count = (s: DocState) => [...states.values()].filter((x) => x === s).length;
  const health = { current: count("current"), ageing: count("ageing"), unverified: count("unverified") };
  const showingAgeing = show === "ageing";

  // Curated by the owner; until someone does, lead with the three most
  // recently confirmed Current docs so the shelf is not empty on day one.
  const curated = (space.start_here ?? []).map((id) => byId.get(id)).filter(Boolean) as DocWithSpace[];
  const startHere = curated.length
    ? curated
    : docs
        .filter((d) => states.get(d.id) === "current")
        .sort((a, b) => (b.last_reviewed_at ?? "").localeCompare(a.last_reviewed_at ?? ""))
        .slice(0, 3);
  const path = (space.reading_path ?? []).map((id) => byId.get(id)).filter(Boolean) as DocWithSpace[];
  const progress = await readingPathProgress(workspace.id, path.map((d) => d.id));
  const pathMinutes = path.reduce((n, d) => n + minutes(d.body_md), 0);

  const shelves = buildShelves(showingAgeing ? docs.filter((d) => states.get(d.id) === "ageing") : docs);
  const hasTree = tree.some((d) => d.parent_doc_id !== null);

  return (
    <>
      <AppTopBar
        crumbs={[{ label: "Spaces" }, { label: space.name }]}
        primary={{ label: "Write", href: writeHref }}
      />
      <div className="wrap">
        <div style={{ maxWidth: 840 }}>
          <h1 className="h1" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "var(--text-secondary)", display: "flex" }}>
              <SpaceIcon icon={space.icon} size={24} />
            </span>
            {space.name}
          </h1>

          {docs.length === 0 ? (
            <p className="h1s" style={{ marginTop: 14 }}>
              Nothing here yet.{" "}
              <Link href={writeHref} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                Write the first doc
              </Link>{" "}
              — it becomes findable by the team and readable by your agents.
            </p>
          ) : (
            <>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <HealthBar {...health} />
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-secondary)" }}>
                  {docs.length} doc{docs.length === 1 ? "" : "s"} ·{" "}
                  <b style={{ fontWeight: 600, color: "var(--current-text)" }}>{health.current} current</b> ·{" "}
                  <b style={{ fontWeight: 600, color: "var(--ageing-text)" }}>{health.ageing} ageing</b> · {health.unverified} unverified
                </p>
                {health.ageing > 0 && (
                  <Link
                    href={showingAgeing ? `${base}/s/${space.slug}` : `${base}/s/${space.slug}?show=ageing`}
                    className={`pick${showingAgeing ? " is-on" : ""}`}
                    style={{ marginLeft: "auto", height: 27, fontSize: 12 }}
                  >
                    {showingAgeing ? "Showing what needs a look · clear" : "Show what needs a look →"}
                  </Link>
                )}
              </div>

              {!showingAgeing && (startHere.length > 0 || canCurate) && (
                <section className="sect" style={{ marginTop: 32 }}>
                  <div className="sect-h">
                    <h2>Start here</h2>
                    {canCurate && (
                      <CurateShelves
                        spaceId={space.id}
                        docs={docs.map((d) => ({ id: d.id, title: d.title }))}
                        startHere={space.start_here ?? []}
                        readingPath={space.reading_path ?? []}
                      />
                    )}
                  </div>
                  {startHere.length === 0 && (
                    <p className="h1s" style={{ margin: 0 }}>
                      Nothing is confirmed here yet. Pick the docs a newcomer should read first.
                    </p>
                  )}
                  <div className="grid3">
                    {startHere.map((d) => (
                      <Link key={d.id} href={`${base}/docs/${d.id}`} className="tpl">
                        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Status doc={d} form="dot" />
                          <span className="ty">{typeLabel(d.type)}</span>
                        </span>
                        <b>{d.title || "Untitled"}</b>
                        <span>{summary(d.body_md)} {minutes(d.body_md)} min.</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {!showingAgeing && path.length > 0 && (
                <section className="shelf">
                  <div className="sect-h" style={{ marginBottom: 6 }}><h2>Reading path</h2></div>
                  <h3>New here? Read these {path.length === 1 ? "one" : NUM[path.length] ?? path.length}, in order.</h3>
                  <p>
                    ~{pathMinutes} minutes
                    {progress.finished > 0 && ` · ${progress.finished} ${progress.finished === 1 ? "person has" : "people have"} finished it`}
                  </p>
                  {path.map((d, i) => (
                    <Link key={d.id} href={`${base}/docs/${d.id}`} className="row">
                      <span className="n" style={progress.mine.has(d.id) ? { color: "var(--accent)" } : undefined}>
                        {progress.mine.has(d.id) ? "✓" : i + 1}
                      </span>
                      <span>
                        <span className="t">{d.title || "Untitled"}</span>
                        <span className="m">
                          <Status doc={d} form="dot" />
                          {checkedWords(d)}
                        </span>
                      </span>
                      <span className="m">{minutes(d.body_md)} min</span>
                    </Link>
                  ))}
                </section>
              )}

              {shelves.map((shelf) => (
                <section key={shelf.name} className="shelf">
                  <h3>
                    {shelf.name}{" "}
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>
                      {shelf.docs.length}
                    </span>
                  </h3>
                  {shelf.docs.map((d) => (
                    <Link key={d.id} href={`${base}/docs/${d.id}`} className="row">
                      <Status doc={d} form="dot" />
                      <span>
                        <span className="t">{d.title || "Untitled"}</span>
                        <span className="m">
                          <span className="ty">{typeLabel(d.type)}</span>
                          <span>· {[attribution(d, nameOf(d.owner_id)), shelfReason(d)].filter(Boolean).join(" · ")}</span>
                        </span>
                      </span>
                      <span className="m">{rightDate(d)}</span>
                    </Link>
                  ))}
                </section>
              ))}

              {!showingAgeing && hasTree && (
                <section className="sect">
                  <div className="sect-h"><h2>All pages</h2></div>
                  <DocTree
                    docs={tree.filter((d) => d.status !== "draft")}
                    base={base}
                    spaceSlug={space.slug}
                  />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const NUM = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

function HealthBar({ current, ageing, unverified }: { current: number; ageing: number; unverified: number }) {
  const total = current + ageing + unverified || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="meter"
      role="img"
      aria-label={`${current} current, ${ageing} ageing, ${unverified} unverified`}
    >
      <i style={{ background: "var(--current-text)", width: pct(current) }} />
      <i style={{ background: "var(--ageing-dot)", width: pct(ageing) }} />
      <i style={{ background: "#C9C7BE", width: pct(unverified) }} />
    </div>
  );
}

/** Topic shelves by tag; by doc type when nothing is tagged. */
function buildShelves(docs: DocWithSpace[]): { name: string; docs: DocWithSpace[] }[] {
  const byTag = new Map<string, DocWithSpace[]>();
  for (const d of docs) for (const tag of d.frontmatter?.tags ?? []) byTag.set(tag, [...(byTag.get(tag) ?? []), d]);
  if (byTag.size > 0) {
    const shelves = [...byTag.entries()].sort((a, b) => b[1].length - a[1].length).map(([name, ds]) => ({ name, docs: ds }));
    const loose = docs.filter((d) => !d.frontmatter?.tags?.length);
    if (loose.length) shelves.push({ name: "Everything else", docs: loose });
    return shelves;
  }
  const byType = new Map<string, DocWithSpace[]>();
  for (const d of docs) byType.set(typeLabel(d.type), [...(byType.get(typeLabel(d.type)) ?? []), d]);
  return [...byType.entries()].sort((a, b) => b[1].length - a[1].length).map(([name, ds]) => ({ name, docs: ds }));
}

function attribution(d: DocWithSpace, author: string | null): string {
  const pr = d.frontmatter?.source_pr_url?.match(/\/pull\/(\d+)/)?.[1];
  if (pr) return `from PR #${pr}`;
  if (d.author_type === "agent") return d.agent_id ?? "an agent";
  return author ?? "";
}

function shelfReason(d: DocWithSpace): string {
  const state = docState(d);
  if (d.status === "review") return "waiting on a check";
  if (state === "unverified") return "nobody has checked it";
  if (Date.now() - Date.parse(d.created_at) < 86_400_000) return "published today";
  return "";
}

function rightDate(d: DocWithSpace): string {
  const state = docState(d);
  if (state === "ageing") return checkedWords(d).replace("nobody has confirmed it in ", "");
  if (state === "current") return `checked ${formatRelative(d.last_reviewed_at ?? d.updated_at)}`;
  return formatRelative(d.updated_at);
}

function checkedWords(d: DocWithSpace): string {
  const state = docState(d);
  if (state === "ageing") {
    const months = Math.max(1, Math.floor((Date.now() - Date.parse(d.last_reviewed_at ?? d.updated_at)) / (30 * 86_400_000)));
    return `nobody has confirmed it in ${months} month${months === 1 ? "" : "s"}`;
  }
  if (state === "current") return `checked ${formatRelative(d.last_reviewed_at ?? d.updated_at)}`;
  return "nobody has checked it yet";
}

function minutes(md: string | null): number {
  return Math.max(1, Math.round((md ?? "").split(/\s+/).filter(Boolean).length / 230));
}

/** One line to say what a Start here doc is: its opening sentence. */
function summary(md: string | null): string {
  const para = (md ?? "").split(/\n{2,}/).map((b) => b.trim()).find((b) => b && !b.startsWith("#") && !b.startsWith("|"));
  const sentence = (para ?? "").replace(/[*_`[\]]/g, "").split(/(?<=[.!?])\s/)[0] ?? "";
  return sentence.length > 70 ? `${sentence.slice(0, 68).trimEnd()}…` : sentence;
}

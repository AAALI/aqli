import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getSpaces } from "@/lib/supabase/spaces";
import { searchDocs, type SearchHit } from "@/lib/supabase/docs";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import { getGaps } from "@/lib/supabase/questions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppTopBar from "@/components/layout/AppTopBar";
import Status from "@/components/docs/Status";
import { docState } from "@/lib/doc-status";
import { typeLabel } from "@/lib/doc-display";
import { formatRelative } from "@/lib/utils";
import SearchBox from "./SearchBox";
import SearchAnswer from "./SearchAnswer";

/**
 * Search (v3 §5.11, frame 11): for when the answer needs its sources shown.
 * ⌘K handles the quick version.
 *
 * The answer, then what matched, then what nobody has written down. Matches
 * and gaps render on the server; the answer arrives when the model does, and
 * if it fails the sources stand alone rather than an error card taking their
 * place (§4).
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ q?: string; space?: string; current?: string }>;
}) {
  const { workspace: slug } = await params;
  const { q = "", space: spaceFilter, current } = await searchParams;
  const workspace = await getWorkspaceBySlug(slug);
  const base = `/w/${workspace.slug}`;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const query = q.trim();

  const [spaces, owners, hits, gaps] = await Promise.all([
    getSpaces(workspace.id).catch(() => []),
    getOwnerDirectory(workspace.id),
    query ? searchDocs(workspace.id, query, user?.id ?? null).catch(() => [] as SearchHit[]) : Promise.resolve([] as SearchHit[]),
    query ? getGaps(workspace.id, { sinceDays: 30, limit: 3, match: query }) : Promise.resolve([]),
  ]);

  const spaceById = new Map(spaces.map((s) => [s.id, s]));
  const activeSpace = spaces.find((s) => s.slug === spaceFilter) ?? null;
  const matches = hits.filter(
    (h) => (!activeSpace || h.space_id === activeSpace.id) && (!current || docState(h) === "current"),
  );
  const chipHref = (next: { space?: string | null; current?: boolean }) => {
    const p = new URLSearchParams({ q: query });
    if (next.space) p.set("space", next.space);
    if (next.current) p.set("current", "1");
    return `${base}/search?${p}`;
  };
  const firstWord = query.split(/\s+/).find((w) => w.length > 2)?.toLowerCase() ?? "";

  return (
    <>
      <AppTopBar crumbs={[{ label: "Search" }]} actions={<span className="kbd">⌘K for the quick version</span>} />
      <div className="wrap">
        <div className="wrap-in">
          <SearchBox base={base} initial={query} />

          {!query ? (
            <p className="h1s" style={{ marginTop: 22 }}>
              Ask the way you would ask a colleague. The answer comes with the docs it came from.
            </p>
          ) : (
            <>
              <SearchAnswer key={query} workspaceId={workspace.id} base={base} query={query} />

              <section className="sect">
                <div className="sect-h">
                  <h2>Matches · {matches.length}</h2>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link href={chipHref({})} className={`pick${!activeSpace && !current ? " is-on" : ""}`} style={{ height: 27, fontSize: 12 }}>
                      Everywhere
                    </Link>
                    {spaces.slice(0, 3).map((s) => (
                      <Link key={s.id} href={chipHref({ space: s.slug, current: Boolean(current) })} className={`pick${activeSpace?.id === s.id ? " is-on" : ""}`} style={{ height: 27, fontSize: 12 }}>
                        {s.name}
                      </Link>
                    ))}
                    <Link href={chipHref({ space: activeSpace?.slug, current: !current })} className={`pick${current ? " is-on" : ""}`} style={{ height: 27, fontSize: 12 }}>
                      Current only
                    </Link>
                  </div>
                </div>
                {matches.length === 0 ? (
                  <p className="h1s" style={{ margin: "4px 0 0" }}>No doc mentions that.</p>
                ) : (
                  matches.map((h) => {
                    const [pre, hit, post] = excerpt(h.body_text, firstWord);
                    return (
                      <Link key={h.id} href={`${base}/docs/${h.id}`} className="row" style={{ alignItems: "flex-start" }}>
                        <span style={{ marginTop: 7, display: "flex" }}>
                          <Status doc={h} form="dot" />
                        </span>
                        <span>
                          <span className="t">{h.title || "Untitled"}</span>
                          {(pre || hit || post) && (
                            <p style={{ margin: "6px 0 0", fontFamily: "var(--font-serif)", fontSize: 15, lineHeight: 1.65, color: "var(--text-secondary)" }}>
                              “{pre}
                              {hit && <mark style={{ background: "var(--ageing-bg)", color: "inherit" }}>{hit}</mark>}
                              {post}”
                            </p>
                          )}
                          <span className="m">
                            <span className="ty">{typeLabel(h.type)}</span>
                            <span>
                              · {[spaceById.get(h.space_id ?? "")?.name, why(h, h.owner_id ? owners[h.owner_id]?.name ?? null : null)].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                        </span>
                        <span className="m">{minutes(h.body_text)} min</span>
                      </Link>
                    );
                  })
                )}
              </section>

              {gaps.length > 0 && (
                <section className="sect">
                  <div className="sect-h"><h2>Nobody has written this down</h2></div>
                  {gaps.map((g) => (
                    <div key={g.normalized} className="row" style={{ cursor: "default" }}>
                      <span className="n">{g.count}×</span>
                      <span>
                        <span className="t q">“{g.question}”</span>
                        <span className="m">asked {g.count === 1 ? "once" : `${g.count} times`} this month · no doc covers it</span>
                      </span>
                      <Link href={`${base}/write?title=${encodeURIComponent(g.question)}`} className="btn btn-sm btn-secondary">
                        Write it
                      </Link>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** Why this match is or isn't trustworthy, in the trust line's words. */
function why(h: SearchHit, author: string | null): string {
  const pr = h.frontmatter?.source_pr_url?.match(/\/pull\/(\d+)/)?.[1];
  if (h.status === "draft") return "your draft";
  if (h.status === "review") return `${pr ? `from PR #${pr} · ` : ""}waiting on a check`;
  const state = docState(h);
  const who = pr ? `from PR #${pr}` : h.author_type === "agent" ? (h.agent_id ?? "an agent") : author;
  if (state === "current") return [who, `confirmed ${formatRelative(h.last_reviewed_at ?? h.updated_at)}`].filter(Boolean).join(" · ");
  if (state === "ageing") return `nobody has confirmed it in ${Math.max(1, Math.floor((Date.now() - Date.parse(h.last_reviewed_at ?? h.updated_at)) / (30 * 86_400_000)))} months`;
  return [who, "nobody has checked it yet"].filter(Boolean).join(" · ");
}

function excerpt(body: string | null, term: string): [string, string, string] {
  if (!body) return ["", "", ""];
  const idx = term ? body.toLowerCase().indexOf(term) : -1;
  if (idx < 0) return ["", "", `${body.slice(0, 160).trim()}…`];
  const start = Math.max(0, idx - 60);
  return [
    (start > 0 ? "…" : "") + body.slice(start, idx),
    body.slice(idx, idx + term.length),
    `${body.slice(idx + term.length, idx + term.length + 110).trimEnd()}…`,
  ];
}

function minutes(text: string | null): number {
  return Math.max(1, Math.round((text ?? "").split(/\s+/).filter(Boolean).length / 230));
}

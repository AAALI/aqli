import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getHome, type WaitingItem } from "@/lib/supabase/home";
import { getSpaces } from "@/lib/supabase/spaces";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import AppTopBar from "@/components/layout/AppTopBar";
import Status from "@/components/docs/Status";
import WriteKey from "@/components/home/WriteKey";
import SchemaBehind from "@/components/preflight/SchemaBehind";
import { IconPlus, IconFile } from "@/components/aqli/icons";
import { loadOrDrift } from "@/lib/preflight/drift";
import { dayGreeting, homeSummary, shortDay, whereLeftOff } from "@/lib/home";
import { docState } from "@/lib/doc-status";
import { formatRelative, avatarColor } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

/**
 * Home answers one question (v3 §5.7): what should I read, write, or check
 * today. Where you left off, what is waiting on you, what is new since
 * Monday, and what people keep asking that nothing answers.
 *
 * No notification bell, no review counter, no stats row. A brand-new
 * workspace gets the first-run screen (frame 04) instead: one target, three
 * patterns, and a cursor waiting.
 */
export default async function WorkspaceHome({
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

  const loaded = await loadOrDrift(() =>
    Promise.all([
      getHome(workspace.id, user?.id ?? null),
      getSpaces(workspace.id),
      getOwnerDirectory(workspace.id),
    ]),
  );
  if (!loaded.ok) {
    return <SchemaBehind drift={loaded.drift} healthHref={`/w/${slug}/settings/health`} />;
  }
  const [home, spaces, owners] = loaded.data;

  const base = `/w/${workspace.slug}`;
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "there";
  const firstName = fullName.split(" ")[0];
  const writeHref = spaces[0] ? `${base}/write?space=${spaces[0].slug}` : `${base}/write`;
  const nameOf = (id: string | null) =>
    id ? (id === user?.id ? "You" : (owners[id]?.name ?? "A teammate")) : null;

  if (!home.hasPublished && !home.leftOff) {
    return <FirstRun base={base} firstName={firstName} writeHref={writeHref} />;
  }

  return (
    <>
      <AppTopBar crumbs={[{ label: "Home" }]} primary={{ label: "Write", href: writeHref }} />
      <div className="wrap">
        <div className="wrap-in">
          <h1 className="h1">{dayGreeting()}</h1>
          <p className="h1s">{homeSummary(home.draftCount, home.waiting.length)}</p>

          {home.leftOff && <LeftOff base={base} doc={home.leftOff} />}

          {home.waiting.length > 0 && (
            <section className="sect">
              <div className="sect-h">
                <h2>Waiting on you</h2>
                {home.checksTotal > 0 && <Link href={`${base}/checks`}>All checks →</Link>}
              </div>
              {home.waiting.map((w) => (
                <WaitingRow key={`${w.kind}-${w.doc.id}`} base={base} item={w} />
              ))}
            </section>
          )}

          {home.newSince.length > 0 && (
            <section className="sect">
              <div className="sect-h">
                <h2>New since Monday</h2>
              </div>
              {home.newSince.map((d) => (
                <Link key={d.id} href={`${base}/docs/${d.id}`} className="row">
                  <Status doc={d} form="dot" />
                  <span>
                    <span className="t">{d.title || "Untitled"}</span>
                    <span className="m">
                      {d.space && <span className="ty">{d.space.name}</span>}
                      <span>· {provenance(d, nameOf(d.owner_id))}</span>
                    </span>
                  </span>
                  <span className="m">{shortDay(d.created_at)}</span>
                </Link>
              ))}
            </section>
          )}

          {home.gaps.length > 0 && (
            <section className="sect">
              <div className="sect-h">
                <h2>Asked this week · no doc answers it</h2>
              </div>
              {home.gaps.map((g) => (
                <div key={g.normalized} className="row" style={{ cursor: "default" }}>
                  <span className="n">{g.count}×</span>
                  <span>
                    <span className="t q">“{g.question}”</span>
                    <span className="m">
                      asked by {g.askers} {g.askers === 1 ? "person" : "people"} · last asked{" "}
                      {formatRelative(g.lastAsked)}
                    </span>
                  </span>
                  <Link
                    href={`${base}/write?title=${encodeURIComponent(g.question)}${spaces[0] ? `&space=${spaces[0].slug}` : ""}`}
                    className="btn btn-sm btn-secondary"
                  >
                    Write it
                  </Link>
                </div>
              ))}
            </section>
          )}

          {home.waiting.length === 0 && home.newSince.length === 0 && home.gaps.length === 0 && (
            <p className="h1s" style={{ marginTop: 36 }}>
              Nothing new this week, and nobody is waiting on you.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function LeftOff({ base, doc }: { base: string; doc: DocWithSpace }) {
  const { section, midSentence } = whereLeftOff(doc.body_md);
  const where = section
    ? midSentence
      ? `you stopped mid-sentence in “${section}”`
      : `last written in “${section}”`
    : "not started yet";
  return (
    <div className="card" style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 18, padding: "16px 18px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="eyebrow-s">Where you left off</p>
        <p style={{ margin: "6px 0 0", fontFamily: "var(--font-serif)", fontSize: 19, fontWeight: 500, letterSpacing: "-0.008em" }}>
          {doc.title || "Untitled"}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
          In Drafts · {where} · {formatRelative(doc.updated_at)}
        </p>
      </div>
      <Link href={`${base}/docs/${doc.id}/edit`} className="btn btn-primary">
        Keep writing
      </Link>
    </div>
  );
}

function WaitingRow({ base, item }: { base: string; item: WaitingItem }) {
  const { doc } = item;
  const minutes = readMinutes(doc.body_md);
  return (
    <Link href={`${base}/docs/${doc.id}`} className="row">
      <Status doc={doc} state={item.kind === "asked" ? "unverified" : docState(doc)} />
      <span>
        <span className="t">{doc.title || "Untitled"}</span>
        <span className="m">
          {item.kind === "asked" ? (
            <>
              {item.askedBy && (
                <span
                  className="avatar"
                  aria-hidden
                  style={{ width: 20, height: 20, flexBasis: 20, fontSize: 9, background: avatarColor(item.askedBy) }}
                >
                  {item.askedBy.charAt(0).toUpperCase()}
                </span>
              )}
              {item.askedBy ?? "Someone"} asked you to check it · {formatRelative(item.askedAt)} · {minutes} min read
            </>
          ) : (
            <>
              You own it · nobody has confirmed it in {sinceWords(doc.last_reviewed_at)}
              {item.citedBy > 0 && ` · ${item.citedBy} doc${item.citedBy === 1 ? "" : "s"} cite it`}
            </>
          )}
        </span>
      </span>
      <span className="btn btn-sm btn-secondary">{item.kind === "asked" ? "Check" : "Still true?"}</span>
    </Link>
  );
}

function FirstRun({ base, firstName, writeHref }: { base: string; firstName: string; writeHref: string }) {
  const patterns = [
    { type: "how_to", name: "How-to", line: "Steps someone can follow without asking you." },
    { type: "decision", name: "Decision", line: "What we chose, what we rejected, why." },
    { type: "brief", name: "Brief", line: "What we're doing, for whom, by when." },
  ];
  const sep = writeHref.includes("?") ? "&" : "?";
  return (
    <>
      <AppTopBar
        crumbs={[{ label: "Home" }]}
        secondary={{ label: "Invite your team", href: `${base}/settings/members` }}
      />
      <WriteKey href={writeHref} />
      <div className="wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 140 }}>
        <div style={{ width: "100%", maxWidth: 660 }}>
          <h1 className="h1" style={{ fontSize: 36 }}>A clean slate, {firstName}.</h1>
          <p className="h1s" style={{ maxWidth: 470 }}>
            Write one thing. Everything else in Aqli — search, checking, your agents — starts
            working the moment there&apos;s something here.
          </p>
          <Link
            href={writeHref}
            className="btn btn-primary"
            style={{ marginTop: 26, height: 52, padding: "0 24px", fontSize: 16, borderRadius: 9 }}
          >
            <IconPlus size={18} /> Start writing
            <span className="kbd" style={{ borderColor: "rgba(255,255,255,.3)", color: "rgba(255,255,255,.72)", marginLeft: 6 }}>
              N
            </span>
          </Link>
          <p className="eyebrow-s" style={{ margin: "34px 0 10px", letterSpacing: "0.13em" }}>
            Or start from a pattern
          </p>
          <div className="grid3">
            {patterns.map((p) => (
              <Link key={p.type} href={`${writeHref}${sep}type=${p.type}`} className="tpl">
                <b>{p.name}</b>
                <span>{p.line}</span>
              </Link>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 28 }}>
            <IconFile size={13} /> Bringing docs from Notion or Confluence?{" "}
            <Link href={`${base}/settings/import`} style={{ color: "var(--accent)", textDecoration: "none" }}>
              Import them
            </Link>{" "}
            — links and headings survive.
          </p>
        </div>
      </div>
    </>
  );
}

/** Where a new doc came from, in words (§3.6: attributed, never chipped). */
function provenance(d: DocWithSpace, author: string | null): string {
  const pr = d.frontmatter?.source_pr_url?.match(/\/pull\/(\d+)/)?.[1];
  const tail = docState(d) === "unverified" ? " · nobody has checked it yet" : "";
  if (pr) return `written from PR #${pr}${tail}`;
  if (d.author_type === "agent") return `written by ${d.agent_id ?? "an agent"}${tail}`;
  return `${author ?? "A teammate"}${tail}`;
}

function readMinutes(md: string | null): number {
  return Math.max(1, Math.round((md ?? "").split(/\s+/).filter(Boolean).length / 230));
}

/** "4 months", "3 weeks" — how long nobody has confirmed something. */
function sinceWords(iso: string | null): string {
  if (!iso) return "a while";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days >= 60) return `${Math.floor(days / 30)} months`;
  if (days >= 14) return `${Math.floor(days / 7)} weeks`;
  return `${days} days`;
}

import Link from "next/link";
import { getWorkspaceBySlug } from "@/lib/supabase/workspaces";
import { getOwnerDirectory } from "@/lib/supabase/owners";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import AppTopBar from "@/components/layout/AppTopBar";
import DeleteDraftButton from "@/components/docs/DeleteDraftButton";
import { IconFile } from "@/components/aqli/icons";
import { whereLeftOff, shortDay } from "@/lib/home";
import { toPlainText } from "@/lib/mentions";
import { avatarColor, formatRelative } from "@/lib/utils";
import type { DocWithSpace } from "@/types/doc";

const DOC_SELECT = "*, space:spaces(id, workspace_id, name, slug, icon, created_at)";
const COUNT = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/**
 * Drafts (v3 §5.15, frame 15). Framed around finishing, not review.
 *
 * "Draft" is a place, not a state. The subhead states the privacy contract
 * plainly, and the page keeps it: yours, then drafts other people started and
 * brought you into by mentioning you on them. Everyone else's drafts are not
 * shown — the old "Elsewhere in the workspace" list broke the contract.
 */
export default async function DraftsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: slug } = await params;
  const workspace = await getWorkspaceBySlug(slug);
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const base = `/w/${workspace.slug}`;

  const [{ data: mineRaw }, { data: mentions }, owners] = await Promise.all([
    user
      ? supabase
          .from("docs")
          .select(DOC_SELECT)
          .eq("workspace_id", workspace.id)
          .eq("status", "draft")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    // Drafts you were brought into: someone mentioned you on one.
    user
      ? supabase
          .from("doc_comments")
          .select("doc_id, author_id, body, created_at")
          .eq("workspace_id", workspace.id)
          .contains("mentions", [user.id])
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    getOwnerDirectory(workspace.id),
  ]);
  const mine = (mineRaw ?? []) as DocWithSpace[];

  const asks = new Map<string, { author_id: string | null; body: string; created_at: string }>();
  for (const m of (mentions ?? []) as { doc_id: string; author_id: string | null; body: string; created_at: string }[]) {
    if (!asks.has(m.doc_id)) asks.set(m.doc_id, m);
  }
  const { data: sharedRaw } = asks.size
    ? await supabase
        .from("docs")
        .select(DOC_SELECT)
        .in("id", [...asks.keys()])
        .eq("status", "draft")
        .neq("owner_id", user?.id ?? "")
    : { data: [] };
  const shared = (sharedRaw ?? []) as DocWithSpace[];
  const names = Object.fromEntries(Object.entries(owners).map(([id, o]) => [id, o.name]));

  const total = mine.length + shared.length;
  const headline =
    total === 0 ? "Nothing unfinished." : `${COUNT[total] ?? total} unfinished thing${total === 1 ? "" : "s"}.`;
  const writeHref = `${base}/write`;

  return (
    <>
      <AppTopBar crumbs={[{ label: "Drafts" }]} primary={{ label: "Write", href: writeHref }} />
      <div className="wrap">
        <div style={{ maxWidth: 760 }}>
          <h1 className="h1">{headline}</h1>
          <p className="h1s">Nobody can see these but you. They stay drafts until you publish them.</p>

          {mine.length > 0 && (
            <section className="sect">
              <div className="sect-h"><h2>Yours</h2></div>
              {mine.map((d, i) => {
                const empty = !(d.body_md ?? "").trim() && !d.title.trim();
                return (
                  <Link key={d.id} href={`${base}/docs/${d.id}/edit`} className="row">
                    <span style={{ color: empty ? "var(--text-muted)" : "var(--text-secondary)", display: "flex" }}>
                      <IconFile size={16} />
                    </span>
                    <span>
                      <span className="t" style={empty ? { color: "var(--text-secondary)" } : undefined}>
                        {d.title || "Untitled"}
                      </span>
                      <span className="m">{describe(d)}</span>
                    </span>
                    {empty ? (
                      <DeleteDraftButton docId={d.id} />
                    ) : (
                      <span className={`btn btn-sm ${i === 0 ? "btn-primary" : "btn-secondary"}`}>Keep writing</span>
                    )}
                  </Link>
                );
              })}
            </section>
          )}

          {shared.length > 0 && (
            <section className="sect">
              <div className="sect-h"><h2>Started by others, shared with you</h2></div>
              {shared.map((d) => {
                const ask = asks.get(d.id);
                const who = d.owner_id ? (owners[d.owner_id]?.name ?? "A teammate") : "A teammate";
                return (
                  <Link key={d.id} href={`${base}/docs/${d.id}/edit`} className="row">
                    <span className="avatar" aria-hidden style={{ width: 20, height: 20, flexBasis: 20, fontSize: 9, background: avatarColor(who) }}>
                      {who.charAt(0).toUpperCase()}
                    </span>
                    <span>
                      <span className="t">{d.title || "Untitled"}</span>
                      <span className="m">
                        {who}
                        {ask ? ` · “${clip(toPlainText(ask.body, names))}”` : ""}
                      </span>
                    </span>
                    <span className="m">{ask ? formatRelative(ask.created_at) : shortDay(d.updated_at)}</span>
                  </Link>
                );
              })}
            </section>
          )}

          {total === 0 && (
            <p className="h1s" style={{ marginTop: 30 }}>
              Anything you start and don&apos;t publish waits here.{" "}
              <Link href={writeHref} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                Start writing
              </Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/** "stopped mid-sentence in “X” · 14 min ago", "two paragraphs · started Monday". */
function describe(d: DocWithSpace): string {
  const md = (d.body_md ?? "").trim();
  if (!md) return `empty · started ${formatRelative(d.created_at)}`;
  const { section, midSentence } = whereLeftOff(md);
  if (section && midSentence) return `stopped mid-sentence in “${section}” · ${formatRelative(d.updated_at)}`;
  const paras = md.split(/\n{2,}/).filter((b) => b.trim() && !b.trim().startsWith("#")).length;
  const size = paras === 0 ? "headings only" : paras === 1 ? "one paragraph" : paras === 2 ? "two paragraphs" : `${paras} paragraphs`;
  return `${size} · started ${shortDay(d.created_at)}`;
}

function clip(s: string, n = 70): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

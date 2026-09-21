import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDoc, getDocVersions, getBacklinks, getDocPath } from "@/lib/supabase/docs";
import { getOwnerDirectory, ownerInfo } from "@/lib/supabase/owners";
import { getDocCommentThread } from "@/lib/supabase/comments";
import { listWorkspaceMembers, getMyRole } from "@/lib/supabase/members";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDocActivity } from "@/lib/supabase/activity";
import { recordRead } from "@/lib/supabase/questions";
import TrustLine from "@/components/docs/TrustLine";
import ReadingRail, { CitingDoc, type HistoryEntry } from "@/components/docs/ReadingRail";
import DocComments from "@/components/docs/DocComments";
import DocAskAssistant from "@/components/docs/DocAskAssistant";
import DocBodyClient from "@/components/docs/DocBodyClient";
import ShareButton from "@/components/docs/ShareButton";
import { IconChevRight, IconEdit } from "@/components/aqli/icons";
import CmdKButton from "@/components/cmdk/CmdKButton";
import { isPublished } from "@/lib/doc-status";
import { trustFor } from "@/lib/trust";
import { formatRelative } from "@/lib/utils";

type Loaded<T> = { data: T; failed: false } | { data: null; failed: true };

/**
 * Load something the page can render without.
 *
 * A comment thread that failed to load must not arrive as an empty one: to a
 * reader "no comments yet" and "we could not fetch the comments" look
 * identical, and only one of them is true. It also should not take the
 * document down with it — the doc body is why the reader is here.
 */
async function loadSection<T>(work: Promise<T>, what: string): Promise<Loaded<T>> {
  try {
    return { data: await work, failed: false };
  } catch (err) {
    console.error(`doc page: could not load ${what}:`, err);
    return { data: null, failed: true };
  }
}

/**
 * The reading surface (v3 §5.6, frame 06).
 *
 * The same sheet of paper as the writing surface, with one line added under
 * the title — the trust line — and `Cited by` at the foot. The rail beside it
 * ships closed. That is the whole page: no metadata row, no provenance bar,
 * no "what changed" banner, no request-review button. Provenance is said in
 * words on the trust line; what changed lives in History, one tab away.
 */
export default async function DocViewPage({
  params,
}: {
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace: wsSlug, id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) notFound();

  const base = `/w/${wsSlug}`;
  // An unpublished doc has no reading surface: a draft is a place you finish
  // things in, and nobody but its author can see it (§3.2).
  if (!isPublished(doc.status)) redirect(`${base}/docs/${doc.id}/edit`);

  const [versions, backlinks, owners, thread, members, role, activity, supabase] =
    await Promise.all([
      getDocVersions(id).catch(() => []),
      getBacklinks(id, doc.workspace_id).catch(() => []),
      getOwnerDirectory(doc.workspace_id),
      loadSection(getDocCommentThread(doc.workspace_id, id), "the comment thread"),
      loadSection(listWorkspaceMembers(doc.workspace_id), "the member list"),
      getMyRole(doc.workspace_id),
      getDocActivity(doc.workspace_id, doc.id, 50).catch(() => []),
      createServerSupabaseClient(),
      // Once per person per doc — what reading-path completion counts.
      recordRead(doc.workspace_id, doc.id),
    ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = role === "admin" || role === "editor";
  const nameOf = (userId: string | null) =>
    userId ? (userId === user?.id ? "you" : (owners[userId]?.name ?? "a teammate")) : null;

  // Who it is waiting on: the people named in the latest ask on the doc's own
  // review trail. Only meaningful while the doc is actually waiting.
  const comments = thread.data?.comments ?? [];
  const lastAsk = [...comments].reverse().find((c) => c.comment_type === "review_request");
  const waitingOn =
    doc.status === "review" && lastAsk
      ? lastAsk.mentions.map((uid) => ({ id: uid, name: owners[uid]?.name ?? "a teammate" }))
      : [];

  // Who last stood behind it. `last_reviewed_at` records when but not who, so
  // the name comes from the activity log. A PR merge confirms without a
  // person, which the trust line says in its own words.
  const checkEvent = activity.find((a) => a.action === "reviewed" || a.action === "approved");
  const lastCheck = checkEvent
    ? { name: checkEvent.actor_id === user?.id ? "you" : (checkEvent.actor_name ?? null), at: checkEvent.created_at }
    : doc.last_reviewed_at
      ? { name: null, at: doc.last_reviewed_at }
      : null;

  const trust = trustFor({
    doc,
    authorName: nameOf(doc.owner_id),
    lastCheck,
    waitingOn,
    viewerId: user?.id ?? null,
    canEdit,
    relative: formatRelative,
  });

  const history: HistoryEntry[] = versions.map((v) => ({
    id: v.id,
    label: `v${v.version_number} · ${v.version_number === 1 ? "First published" : v.change_type === "agent_edit" ? "Edited by an agent" : "Edited"}`,
    who: nameOf(v.author_id) ?? "an agent",
    at: v.created_at,
  }));

  const spaceCrumb = doc.space
    ? { label: doc.space.name, href: `${base}/s/${doc.space.slug}` }
    : { label: "Home", href: base };
  // Sub-pages: the crumb trail is space › parent › … › this document, so a
  // reader who arrived from search knows which section they are standing in.
  const ancestors = doc.parent_doc_id ? await getDocPath(doc.id).catch(() => []) : [];

  return (
    <>
      {/* Bare: the paper must not sit under a rule (§2). */}
      <div className="tb bare">
        <nav className="tb-crumb" aria-label="Breadcrumb">
          <Link href={spaceCrumb.href}>{spaceCrumb.label}</Link>
          {ancestors.map((a) => (
            <span key={a.id} style={{ display: "contents" }}>
              <span className="crumb-sep"><IconChevRight size={12} /></span>
              <Link href={`${base}/docs/${a.id}`}>{a.title}</Link>
            </span>
          ))}
          <span className="crumb-sep"><IconChevRight size={12} /></span>
          <span className="crumb-cur">{doc.title}</span>
        </nav>
        <div className="tb-spacer" />
        <div className="tb-actions">
          {canEdit && (
            <Link href={`${base}/docs/${doc.id}/edit`} className="btn btn-ghost">
              <IconEdit size={14} />
              Edit
            </Link>
          )}
          <ShareButton />
          <CmdKButton />
        </div>
      </div>

      <div className="main-body">
        <div id="doc-scroll" className="doc-scroll">
          <article id="doc-article" className="doc-col">
            <h1 className="dt">{doc.title}</h1>
            {trust && <TrustLine docId={doc.id} trust={trust} />}

            <div id="doc-body">
              <DocBodyClient bodyMd={doc.body_md} title={doc.title} />
            </div>

            {/* Cited-by also lives at the foot, so the information exists
                with the rail shut (§4). */}
            {backlinks.length > 0 && (
              <section style={{ marginTop: 52, paddingTop: 22, borderTop: "1px solid var(--border)" }}>
                <div className="sect-h">
                  <h2>
                    Cited by {backlinks.length} doc{backlinks.length === 1 ? "" : "s"}
                  </h2>
                </div>
                {backlinks.map((b) => (
                  <CitingDoc key={b.id} base={base} doc={b} />
                ))}
              </section>
            )}

            <div id="doc-comments">
              <DocComments
                docId={doc.id}
                initial={comments}
                names={thread.data?.names ?? {}}
                threadFailed={thread.failed}
                members={(members.data ?? []).map((m) => ({
                  user_id: m.user_id,
                  name: ownerInfo(m).name,
                  email: m.email,
                }))}
                membersFailed={members.failed}
                currentUserId={user?.id ?? null}
                canComment={canEdit}
                canModerate={role === "admin"}
              />
            </div>
          </article>
        </div>

        <ReadingRail base={base} docId={doc.id} backlinks={backlinks} history={history} />

        {/* The one AI element here too: a dot, scoped to this doc. It sits
            clear of the closed rail's 40px tab. */}
        <DocAskAssistant
          workspaceId={doc.workspace_id}
          workspaceSlug={wsSlug}
          docId={doc.id}
          docTitle={doc.title}
        />
      </div>
    </>
  );
}


import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc, saveDoc } from "@/lib/supabase/docs";
import { getMyRole } from "@/lib/supabase/members";
import { scoped } from "@/lib/db";
import { recordAudit, humanActor } from "@/lib/audit";
import { embedDoc } from "@/lib/ai/embedder";
import { logActivity, logEditCoalesced } from "@/lib/supabase/activity";
import { MergeError } from "@/lib/db/proposals";

type Params = { params: Promise<{ id: string }> };

function actorName(user: { email?: string; id: string; user_metadata?: Record<string, unknown> }) {
  return (
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    user.id
  );
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // getDoc throws when the doc doesn't exist or RLS hides it — that's a 404,
  // not a 500.
  const doc = await getDoc(id).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ doc });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  // Whitelist the client-editable fields. Everything else — provenance
  // (author_type, agent_id), freshness (last_reviewed_at, set only via
  // /reviewed), workspace_id — is server-controlled; passing the raw body to
  // .update() would let any member forge those columns.
  const EDITABLE = [
    "title",
    "type",
    "status",
    "owner_id",
    "body_json",
    "body_md",
    "frontmatter",
    "space_id",
  ] as const;
  const updates = Object.fromEntries(
    EDITABLE.filter((k) => k in body).map((k) => [k, body[k]]),
  ) as Parameters<typeof saveDoc>[1];
  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });

  // Read the prior status so we can tell a status change from a content edit.
  // A missing/RLS-hidden doc is a 404 here too — saveDoc's .single() would
  // otherwise surface it as a 500.
  const before = await getDoc(id).catch(() => null);
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Archiving has its own route, which takes the sub-pages along and keeps
  // what to restore to; a bare status write would do neither. And an archived
  // page is put away: restore it before changing it.
  if (updates.status === "archived") {
    return NextResponse.json({ error: "Archive with POST /api/docs/[id]/archive" }, { status: 400 });
  }
  if (before.status === "archived") {
    return NextResponse.json({ error: "This page is archived. Restore it to edit it." }, { status: 409 });
  }

  let result;
  try {
    result = await saveDoc(id, updates);
  } catch (err) {
    // The merge engine's refusals are answers, not failures: `stale_base`
    // means the document moved and the client should re-read and re-send.
    if (err instanceof MergeError) {
      return NextResponse.json(
        { error: err.code, current_revision_id: before.current_revision_id ?? null },
        { status: err.status },
      );
    }
    throw err;
  }

  const { doc, proposal } = result;

  // Queued for review: the document is unchanged, so there is nothing to
  // re-embed and nothing to log against it as an edit. 202 rather than 200 —
  // the client must not report this as saved.
  if (proposal && proposal.state === "open") {
    return NextResponse.json(
      { doc: before, proposal: { id: proposal.proposalId, state: proposal.state } },
      { status: 202 },
    );
  }

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Re-embed when the doc body changes. Fire-and-forget so we don't block
  // the editor's autosave response on the OpenAI round-trip.
  if (typeof updates.body_md === "string") {
    embedDoc(doc).catch((err) =>
      console.error("Embed failed for doc", doc.id, err),
    );
  }

  // Activity log: a status change is the headline event; otherwise a body
  // edit is recorded as a coalesced `updated` (autosave fires this often).
  const name = actorName(user);
  if (updates.status && before && before.status !== updates.status) {
    await logActivity({
      docId: doc.id,
      workspaceId: doc.workspace_id,
      actorType: "human",
      actorId: user.id,
      actorName: name,
      action: "status_changed",
      metadata: { from_status: before.status, to_status: updates.status },
    });
  } else if (typeof updates.body_md === "string") {
    await logEditCoalesced({
      docId: doc.id,
      workspaceId: doc.workspace_id,
      actorId: user.id,
      actorName: name,
    });
  }

  return NextResponse.json({
    doc,
    ...(proposal ? { proposal: { id: proposal.proposalId, state: proposal.state } } : {}),
  });
}

/**
 * Delete a document for good.
 *
 * Two cases, and neither is "any member deletes anything":
 *
 *   · a draft is discarded by the person writing it. Nobody else can see it
 *     (drafts are private), so nobody else can throw it away. A legacy draft
 *     with no owner falls to an admin.
 *   · a published page is archived first (`/archive`) and only then deleted,
 *     by its owner or an admin. Archive is the everyday "put it away"; delete
 *     is the step that cannot be undone, so it is never one click from a live
 *     page.
 *
 * Deleting takes the page's history and comments with it. The audit log keeps
 * the fact, the title and a measure of what was lost.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Read through RLS: a doc this person cannot see is "not found", which is
  // also what stops anyone discarding someone else's private draft.
  const doc = await getDoc(id).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getMyRole(doc.workspace_id);
  const isAdmin = role === "admin";
  const isOwner = doc.owner_id === user.id;
  const isDraft = doc.status === "draft";

  if (isDraft) {
    if (!(isOwner || (doc.owner_id === null && isAdmin))) {
      return NextResponse.json({ error: "Only the person writing a draft can discard it" }, { status: 403 });
    }
  } else if (doc.status !== "archived") {
    return NextResponse.json(
      { error: "Archive the page first. Deleting is only offered from the archive." },
      { status: 409 },
    );
  } else if (!(isOwner || isAdmin)) {
    return NextResponse.json({ error: "Only the page's owner or an admin can delete it" }, { status: 403 });
  }

  const db = scoped(doc.workspace_id);
  // Counted before the delete, because the cascade takes them.
  const [{ count: revisions }, { count: comments }] = await Promise.all([
    db.from("revisions").select("id", { count: "exact", head: true }).eq("doc_id", id),
    db.from("doc_comments").select("id", { count: "exact", head: true }).eq("doc_id", id),
  ]);

  const { error } = await db.from("docs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const body = doc.body_md ?? "";
  await recordAudit({
    workspaceId: doc.workspace_id,
    actor: humanActor(user),
    action: isDraft ? "draft.discarded" : "doc.deleted",
    target: { type: isDraft ? "draft" : "doc", id, label: doc.title },
    docId: id,
    spaceId: doc.space_id,
    metadata: {
      space: doc.space?.name ?? null,
      owner_id: doc.owner_id,
      status_before_archive: doc.status_before_archive ?? null,
      created_at: doc.created_at,
      words: body.trim() ? body.trim().split(/\s+/).length : 0,
      revisions: revisions ?? 0,
      comments: comments ?? 0,
    },
  });

  return NextResponse.json({ success: true });
}

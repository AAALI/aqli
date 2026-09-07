import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc } from "@/lib/supabase/docs";
import { scoped } from "@/lib/db";
import { logActivity } from "@/lib/supabase/activity";
import { formatMention } from "@/lib/mentions";
import { listWorkspaceMembers } from "@/lib/supabase/members";
import { ownerInfo } from "@/lib/supabase/owners";

type Params = { params: Promise<{ id: string }> };

/**
 * Publish a draft (v3 §3, §4).
 *
 * The whole of the process the writing surface stopped asking about, applied
 * in one call: where it lives, and whether anyone was asked to confirm it.
 *
 * The two outcomes are the two halves of the status rule:
 *
 *   · nobody asked to check it → **Current**, confirmed by the author.
 *     Publishing is itself the confirmation. Your own docs do not need a
 *     second signature and are not going to nag you for one.
 *   · someone asked to check it → **Unverified**, waiting on them. The trust
 *     line reads "waiting on Sara and Khalid" and the action is Nudge.
 *
 * The lifecycle column is set alongside, because the merge engine still reads
 * it — but nothing renders it. `last_reviewed_at` is what the status component
 * actually derives from.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    space_id?: string | null;
    checker_ids?: string[];
  };
  const checkerIds = Array.isArray(body.checker_ids) ? body.checker_ids.filter(Boolean) : [];

  // Checkers have to be people who can actually act on a check. Anything else
  // in the list is dropped rather than silently addressed to nobody.
  const members = await listWorkspaceMembers(doc.workspace_id).catch(() => []);
  const byId = new Map(members.map((m) => [m.user_id, ownerInfo(m)]));
  const checkers = checkerIds.filter((cid) => byId.has(cid) && cid !== user.id);

  const db = scoped(doc.workspace_id);
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    space_id: body.space_id ?? doc.space_id,
    status: checkers.length > 0 ? "review" : "approved",
    // Confirmed by publishing, or explicitly not yet confirmed by anyone.
    last_reviewed_at: checkers.length > 0 ? null : now,
  };
  const { error } = await db.from("docs").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const actorName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? user.id;

  if (checkers.length > 0) {
    // The ask itself, on the doc's own thread — the same undeletable review
    // trail everything else in Checks reads from. Mentions carry the names so
    // the people asked are addressed, not merely listed.
    await db.from("doc_comments").insert({
      doc_id: id,
      author_id: user.id,
      body: `Asked ${checkers.map((cid) => formatMention(cid, byId.get(cid)!.name)).join(" and ")} to check this.`,
      comment_type: "review_request",
    });
  }

  await logActivity({
    docId: id,
    workspaceId: doc.workspace_id,
    actorType: "human",
    actorId: user.id,
    actorName,
    action: checkers.length > 0 ? "review_requested" : "approved",
    metadata: { checkers },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    state: checkers.length > 0 ? "unverified" : "current",
    checkers: checkers.map((cid) => byId.get(cid)!.name),
  });
}

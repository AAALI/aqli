import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc } from "@/lib/supabase/docs";
import { scoped } from "@/lib/db";
import { logActivity } from "@/lib/supabase/activity";
import { formatMention } from "@/lib/mentions";
import { getMyRole, listWorkspaceMembers } from "@/lib/supabase/members";
import { ownerInfo } from "@/lib/supabase/owners";
import { decideDisposition } from "@/lib/merge/disposition";

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
  const role = await getMyRole(doc.workspace_id);
  if (role !== "admin" && role !== "editor") {
    return NextResponse.json({ error: "You need editor or admin rights to publish." }, { status: 403 });
  }
  if (role !== "admin" && doc.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the draft's author or an admin can publish it." }, { status: 403 });
  }
  if (doc.status !== "draft") {
    return NextResponse.json({ error: "Only a draft can be published." }, { status: 409 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected a JSON object." }, { status: 400 });
  }
  const choice = body as Record<string, unknown>;
  if (choice.space_id != null && (typeof choice.space_id !== "string" || !choice.space_id.trim())) {
    return NextResponse.json({ error: "Choose a valid space." }, { status: 400 });
  }
  const spaceId = (choice.space_id as string | null | undefined) ?? doc.space_id;
  if (spaceId) {
    // Read as the caller: a service-role update must not move a draft into
    // another workspace, or into a private space the writer cannot access.
    const { data: space, error: spaceError } = await supabase
      .from("spaces")
      .select("id, review_policy")
      .eq("workspace_id", doc.workspace_id)
      .eq("id", spaceId)
      .maybeSingle();
    if (spaceError || !space) {
      return NextResponse.json({ error: "Choose a space you can access in this workspace." }, { status: 400 });
    }
    // This route changes lifecycle metadata directly; it cannot represent a
    // publish proposal. Refuse destinations that require one rather than
    // bypassing their policy (including for admins).
    if (decideDisposition({
      spacePolicy: space.review_policy,
      actorType: "human",
      scopes: [],
      docClass: doc.doc_class,
    }) !== "merge") {
      return NextResponse.json(
        { error: "This space requires review. Direct publishing is unavailable; choose another space or keep this as a draft." },
        { status: 409 },
      );
    }
  }
  const checkerIds = Array.isArray(choice.checker_ids)
    ? [...new Set(choice.checker_ids.filter((cid): cid is string => typeof cid === "string" && cid.length > 0))]
    : [];

  // Checkers have to be people who can actually act on a check. Anything else
  // in the list is dropped rather than silently addressed to nobody.
  let members: Awaited<ReturnType<typeof listWorkspaceMembers>> = [];
  if (checkerIds.length > 0) {
    try {
      members = await listWorkspaceMembers(doc.workspace_id);
    } catch {
      // Do not turn a requested check into "confirmed by you" on a read failure.
      return NextResponse.json({ error: "Could not load the checkers. Try again." }, { status: 503 });
    }
  }
  const byId = new Map(members.filter((m) => m.role === "admin" || m.role === "editor").map((m) => [m.user_id, ownerInfo(m)]));
  const checkers = checkerIds.filter((cid) => byId.has(cid) && cid !== user.id);

  const db = scoped(doc.workspace_id);
  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {
    space_id: spaceId,
    status: checkers.length > 0 ? "review" : "approved",
    // Confirmed by publishing, or explicitly not yet confirmed by anyone.
    last_reviewed_at: checkers.length > 0 ? null : now,
  };
  const { data: published, error } = await db.from("docs")
    .update(patch)
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!published) {
    return NextResponse.json({ error: "This draft changed state. Reload it before publishing." }, { status: 409 });
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
      // Who is being waited on. The trust line, Home and Checks all read
      // this array; the body is only its human-readable form.
      mentions: checkers,
    });
  }

  await logActivity({
    docId: id,
    workspaceId: doc.workspace_id,
    actorType: "human",
    actorId: user.id,
    actorName,
    action: checkers.length > 0 ? "review_requested" : "approved",
    // `published` tells the audit log this is a first publish, not a later
    // approval by someone else.
    metadata: { checkers, published: true },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    state: checkers.length > 0 ? "unverified" : "current",
    checkers: checkers.map((cid) => byId.get(cid)!.name),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc } from "@/lib/supabase/docs";
import { scoped } from "@/lib/db";
import { logActivity } from "@/lib/supabase/activity";
import { formatMention } from "@/lib/mentions";
import { getOwnerDirectory } from "@/lib/supabase/owners";

type Params = { params: Promise<{ id: string }> };

/**
 * "Not my call" (frame 09): take yourself off a check.
 *
 * Written to the review trail as a fresh ask naming whoever is left, so the
 * trust line's "waiting on …" and everyone's Checks stay derived from one
 * place. If nobody is left, the doc stops waiting — it stays Unverified,
 * because nobody confirmed it, but it no longer sits in anyone's queue.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = scoped(doc.workspace_id);
  const { data: asks } = await db
    .from("doc_comments")
    .select("mentions")
    .eq("doc_id", id)
    .eq("comment_type", "review_request")
    .order("created_at", { ascending: false })
    .limit(1);
  const current = ((asks?.[0] as { mentions?: string[] } | undefined)?.mentions ?? []) as string[];
  if (!current.includes(user.id)) {
    return NextResponse.json({ error: "You weren't asked to check this" }, { status: 409 });
  }
  const remaining = current.filter((uid) => uid !== user.id);
  const owners = await getOwnerDirectory(doc.workspace_id).catch(() => ({}) as Record<string, { name: string }>);

  await db.from("doc_comments").insert({
    doc_id: id,
    author_id: user.id,
    body: remaining.length
      ? `Passed on checking this. Still waiting on ${remaining.map((uid) => formatMention(uid, owners[uid]?.name ?? "a teammate")).join(" and ")}.`
      : "Passed on checking this. Nobody else was asked.",
    comment_type: "review_request",
    mentions: remaining,
  });
  if (remaining.length === 0) {
    await db.from("docs").update({ status: "approved" }).eq("id", id);
  }

  await logActivity({
    docId: id,
    workspaceId: doc.workspace_id,
    actorType: "human",
    actorId: user.id,
    actorName: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? user.id,
    action: "commented",
    metadata: { declined_check: true },
  }).catch(() => {});

  return NextResponse.json({ success: true, remaining: remaining.length });
}

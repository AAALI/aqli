import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc } from "@/lib/supabase/docs";
import { CommentError, deleteDocComment } from "@/lib/supabase/comments";
import { recordAudit, humanActor } from "@/lib/audit";

type Params = { params: Promise<{ id: string; commentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, commentId } = await params;
  const doc = await getDoc(id).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    // Whether this caller may delete this row is the delete policy's decision,
    // not this route's: author or workspace admin, and never a review-trail
    // entry. Nothing is re-checked here, so there is only one place to change
    // it.
    // Read first: once it is gone there is nothing to say whose it was.
    const { data: comment } = await supabase
      .from("doc_comments")
      .select("author_id, body, created_at")
      .eq("id", commentId)
      .maybeSingle();
    await deleteDocComment(doc.workspace_id, commentId);
    await recordAudit({
      workspaceId: doc.workspace_id,
      actor: humanActor(user),
      action: "comment.deleted",
      target: { type: "doc", id, label: doc.title },
      docId: id,
      spaceId: doc.space_id,
      metadata: {
        comment_id: commentId,
        comment_author_id: comment?.author_id ?? null,
        comment_created_at: comment?.created_at ?? null,
        excerpt: typeof comment?.body === "string" ? comment.body.slice(0, 280) : null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CommentError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(`DELETE /api/docs/${id}/comments/${commentId} failed:`, err);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc } from "@/lib/supabase/docs";
import { CommentError, deleteDocComment } from "@/lib/supabase/comments";

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
    await deleteDocComment(doc.workspace_id, commentId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof CommentError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(`DELETE /api/docs/${id}/comments/${commentId} failed:`, err);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

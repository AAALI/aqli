import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc } from "@/lib/supabase/docs";
import {
  CommentError,
  createDocComment,
  getDocCommentThread,
} from "@/lib/supabase/comments";
import { logActivity } from "@/lib/supabase/activity";
import { toPlainText } from "@/lib/mentions";

type Params = { params: Promise<{ id: string }> };

/**
 * The workspace a comment belongs to is taken from the doc, never from the
 * request — the same rule as `/api/docs/[id]/activity`. `getDoc` reads through
 * RLS, so a doc in someone else's workspace is a 404 here before any of the
 * comment policies are consulted.
 */
async function resolveDoc(id: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const doc = await getDoc(id).catch(() => null);
  if (!doc) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  return { user, doc };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const resolved = await resolveDoc(id);
  if (resolved.error) return resolved.error;

  const thread = await getDocCommentThread(resolved.doc.workspace_id, id);
  return NextResponse.json(thread);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const resolved = await resolveDoc(id);
  if (resolved.error) return resolved.error;
  const { doc, user } = resolved;

  const payload = (await req.json().catch(() => null)) as { body?: unknown } | null;
  if (typeof payload?.body !== "string")
    return NextResponse.json({ error: "body must be a string" }, { status: 400 });

  try {
    const comment = await createDocComment(doc.workspace_id, id, payload.body);

    // The comment lands in the doc's activity trail too, so "what happened to
    // this doc" stays one list. The preview is the mention-resolved text —
    // an activity row has nowhere to render a mention token.
    await logActivity({
      docId: id,
      workspaceId: doc.workspace_id,
      actorType: "human",
      actorId: user.id,
      actorName: comment.author_name,
      action: "commented",
      metadata: {
        comment_id: comment.id,
        preview: toPlainText(comment.body).slice(0, 140),
        mentioned: comment.mentions.length,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    if (err instanceof CommentError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(`POST /api/docs/${id}/comments failed:`, err);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}

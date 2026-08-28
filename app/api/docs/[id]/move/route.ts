import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc, moveDoc } from "@/lib/supabase/docs";
import { logActivity } from "@/lib/supabase/activity";

type Params = { params: Promise<{ id: string }> };

/**
 * Move a document in the page tree.
 *
 * Separate from `PUT /api/docs/[id]` on purpose. That route saves content, and
 * under the merge engine a save is a proposal that a reviewer may have to
 * approve. A move is not a content change — it writes no revision, does not
 * restamp `updated_at`, and must not queue for review in a `review_all` space,
 * or reorganising a space would fill the review queue with nothing to read.
 *
 * The rules (no cycles, one space per subtree, the depth cap) are enforced by
 * database triggers, so this route validates shape and reports what the
 * database said. A client cannot talk its way past them by calling this
 * directly, and neither can an importer.
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

  let body: { parent_id?: unknown; position?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parentId =
    body.parent_id === null || body.parent_id === undefined ? null : String(body.parent_id);
  const position =
    body.position === null || body.position === undefined ? null : Number(body.position);

  if (position !== null && !Number.isInteger(position)) {
    return NextResponse.json({ error: "position must be a whole number" }, { status: 400 });
  }

  try {
    await moveDoc(id, parentId, position);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not move the document";
    // The triggers raise check violations for a cycle, a cross-space parent and
    // the depth cap. Those are the caller asking for something impossible, not
    // a server fault, and the database's own message is the one worth showing.
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const moved = await getDoc(id).catch(() => null);

  await logActivity({
    docId: id,
    workspaceId: doc.workspace_id,
    actorType: "human",
    actorId: user.id,
    actorName:
      (user.user_metadata?.full_name as string | undefined) || user.email || user.id,
    action: "moved",
    metadata: { from_parent_id: doc.parent_doc_id ?? null, to_parent_id: parentId },
  });

  return NextResponse.json({ doc: moved });
}

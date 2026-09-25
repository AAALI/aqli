import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc } from "@/lib/supabase/docs";
import { getMyRole } from "@/lib/supabase/members";
import { logActivity } from "@/lib/supabase/activity";
import { embedDoc } from "@/lib/ai/embedder";
import { scoped } from "@/lib/db";
import type { Doc } from "@/types/doc";

type Params = { params: Promise<{ id: string }> };

/**
 * Archive a page, or bring one back.
 *
 *   POST   → archive: the page and its sub-pages leave the tree, search, Home
 *            and what agents are given as context. Nothing is destroyed.
 *   DELETE → restore: what was archived together comes back, at the status it
 *            had (a page waiting on a check is still waiting).
 *
 * The subtree walk and the status bookkeeping are one database function
 * (`set_doc_archived`), run as the caller so RLS decides what they may touch.
 * Editors and admins can archive; viewers cannot. Drafts are discarded, not
 * archived — that is `DELETE /api/docs/[id]`.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  return setArchived(params, true);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return setArchived(params, false);
}

async function setArchived(params: Params["params"], archived: boolean) {
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
    return NextResponse.json({ error: "Viewers cannot archive or restore pages" }, { status: 403 });
  }
  if (doc.status === "draft") {
    return NextResponse.json({ error: "A draft is discarded, not archived" }, { status: 409 });
  }

  const { data, error } = await supabase.rpc("set_doc_archived", {
    p_doc_id: id,
    p_archived: archived,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  const ids = ((data ?? []) as string[]).filter(Boolean);

  const db = scoped(doc.workspace_id);
  if (archived && ids.length > 0) {
    // Out of semantic search and agent context now, not at the next re-embed.
    await db.from("doc_chunks").delete().in("doc_id", ids);
  } else if (!archived && ids.length > 0) {
    const { data: restored } = await db.from("docs").select("*").in("id", ids);
    for (const d of (restored ?? []) as Doc[]) {
      embedDoc(d).catch((err) => console.error("Embed failed for doc", d.id, err));
    }
  }

  const actorName =
    (user.user_metadata?.full_name as string | undefined) || user.email || user.id;
  // One entry per page touched: each page's own history should say it was
  // archived, and the audit log should say which ones went together.
  await Promise.all(
    ids.map((docId) =>
      logActivity({
        docId,
        workspaceId: doc.workspace_id,
        actorType: "human",
        actorId: user.id,
        actorName,
        action: archived ? "archived" : "restored",
        metadata: {
          with: docId === id ? null : id,
          pages: ids.length,
          ...(archived ? { status_before: docId === id ? doc.status : undefined } : {}),
        },
      }),
    ),
  );

  return NextResponse.json({ ids, archived });
}

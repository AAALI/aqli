import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc, updateDoc, deleteDoc } from "@/lib/supabase/docs";
import { embedDoc } from "@/lib/ai/embedder";
import { logActivity, logEditCoalesced } from "@/lib/supabase/activity";

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
  ) as Parameters<typeof updateDoc>[1];
  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });

  // Read the prior status so we can tell a status change from a content edit.
  // A missing/RLS-hidden doc is a 404 here too — updateDoc's .single() would
  // otherwise surface it as a 500.
  const before = await getDoc(id).catch(() => null);
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const doc = await updateDoc(id, updates);

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

  return NextResponse.json({ doc });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteDoc(id);
  return NextResponse.json({ success: true });
}

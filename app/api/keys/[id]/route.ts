import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { unscoped } from "@/lib/db";
import { getMyRole } from "@/lib/supabase/members";
import { revokeApiKey, updateApiKeyScopes } from "@/lib/api-keys";
import { normalizeScopes } from "@/lib/agent-scopes";

/**
 * Change what an agent key is allowed to do.
 *
 * Granting `write` is the difference between an agent's change queueing for
 * review and landing straight in the document, so this is an admin action and
 * the admin check runs against the key's own workspace.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  if (body.scopes === undefined)
    return NextResponse.json({ error: "scopes required" }, { status: 400 });

  const service = unscoped(
    "the key id is all the caller has; its workspace is what we are looking up, and the admin check below depends on the answer",
  );
  const { data: key } = await service
    .from("api_keys")
    .select("workspace_id, revoked_at")
    .eq("id", id)
    .single();
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (key.revoked_at)
    return NextResponse.json(
      { error: "This key has been revoked" },
      { status: 409 },
    );

  const role = await getMyRole(key.workspace_id);
  if (role !== "admin")
    return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const scopes = normalizeScopes(body.scopes);
  await updateApiKeyScopes(id, scopes);
  return NextResponse.json({ scopes });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Resolve the key's workspace, then require admin of that workspace.
  const service = unscoped(
    "the key id is all the caller has; its workspace is what we are looking up, and the admin check below depends on the answer",
  );
  const { data: key } = await service
    .from("api_keys")
    .select("workspace_id")
    .eq("id", id)
    .single();
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getMyRole(key.workspace_id);
  if (role !== "admin")
    return NextResponse.json({ error: "Admins only" }, { status: 403 });

  await revokeApiKey(id);
  return NextResponse.json({ success: true });
}

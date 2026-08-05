import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { unscoped } from "@/lib/db";
import { getMyRole } from "@/lib/supabase/members";
import { revokeApiKey } from "@/lib/api-keys";

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

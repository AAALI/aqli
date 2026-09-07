import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";

/**
 * Outbound notification endpoints for a workspace (docs/adoption.md F-5).
 *
 * Admin-only, including for reading: a webhook URL is a capability, and anyone
 * holding it can post into the channel it points at.
 */
const EVENTS = ["mention", "review_requested"] as const;

async function requireAdmin(workspaceId: string | null) {
  if (!workspaceId) return { error: NextResponse.json({ error: "workspace_id is required" }, { status: 400 }) };
  if ((await getMyRole(workspaceId)) !== "admin")
    return { error: NextResponse.json({ error: "Admins only" }, { status: 403 }) };
  return { error: null };
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  const gate = await requireAdmin(workspaceId);
  if (gate.error) return gate.error;

  const { data, error } = await supabase
    .from("workspace_webhooks")
    .select("id, url, events, last_status, last_error, last_delivered_at, created_at")
    .eq("workspace_id", workspaceId!)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ webhooks: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workspaceId = typeof body.workspace_id === "string" ? body.workspace_id : null;
  const gate = await requireAdmin(workspaceId);
  if (gate.error) return gate.error;

  const url = typeof body.url === "string" ? body.url.trim() : "";
  // https only, and said here as well as in the check constraint: this payload
  // carries document titles across the internet.
  if (!/^https:\/\//.test(url)) {
    return NextResponse.json({ error: "The URL must start with https://" }, { status: 400 });
  }

  const events = Array.isArray(body.events)
    ? body.events.filter((e: unknown): e is string => typeof e === "string" && EVENTS.includes(e as never))
    : [];

  const { data, error } = await supabase
    .from("workspace_webhooks")
    .insert({ workspace_id: workspaceId, url, events, created_by: user.id })
    .select("id, url, events, last_status, last_error, last_delivered_at, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ webhook: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const workspaceId = params.get("workspace_id");
  const id = params.get("id");
  const gate = await requireAdmin(workspaceId);
  if (gate.error) return gate.error;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase
    .from("workspace_webhooks")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId!);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

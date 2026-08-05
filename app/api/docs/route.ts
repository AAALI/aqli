import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDocs, createDocument } from "@/lib/supabase/docs";
import { logActivity } from "@/lib/supabase/activity";
import { MergeError } from "@/lib/db/proposals";
import type { DocType, DocStatus } from "@/types/doc";

function actorName(user: { email?: string; id: string; user_metadata?: Record<string, unknown> }) {
  return (
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    user.id
  );
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );

  const docs = await getDocs(workspaceId, {
    spaceId: searchParams.get("space_id") ?? undefined,
    type: (searchParams.get("type") as DocType) ?? undefined,
    status: (searchParams.get("status") as DocStatus) ?? undefined,
    limit: Number(searchParams.get("limit") ?? 50),
    offset: Number(searchParams.get("offset") ?? 0),
  });
  return NextResponse.json({ docs });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.workspace_id)
    return NextResponse.json(
      { error: "workspace_id required" },
      { status: 400 },
    );

  // Build the insert payload explicitly — spreading the raw body would let
  // callers set server-controlled columns (author_type, agent_id, status…).
  let doc, proposal;
  try {
    ({ doc, proposal } = await createDocument({
      workspace_id: body.workspace_id,
      space_id: body.space_id ?? null,
      title: body.title,
      type: body.type,
      body_json: body.body_json,
      body_md: body.body_md,
      frontmatter: body.frontmatter,
      owner_id: user.id,
    }));
  } catch (err) {
    if (err instanceof MergeError) {
      return NextResponse.json({ error: err.code }, { status: err.status });
    }
    throw err;
  }

  // A `review_all` space queues even a human's new document, so there is no
  // document to return or to log against yet.
  if (!doc) {
    return NextResponse.json(
      { proposal: { id: proposal?.proposalId, state: proposal?.state } },
      { status: 202 },
    );
  }

  await logActivity({
    docId: doc.id,
    workspaceId: doc.workspace_id,
    actorType: "human",
    actorId: user.id,
    actorName: actorName(user),
    action: "created",
  });

  return NextResponse.json({ doc }, { status: 201 });
}

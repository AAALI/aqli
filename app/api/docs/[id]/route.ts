import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDoc, updateDoc, deleteDoc } from "@/lib/supabase/docs";
import { embedDoc } from "@/lib/ai/embedder";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await getDoc(id);
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
  const updates = await req.json();
  const doc = await updateDoc(id, updates);

  // Re-embed when the doc body changes. Fire-and-forget so we don't block
  // the editor's autosave response on the OpenAI round-trip.
  if (typeof updates.body_md === "string") {
    embedDoc(doc).catch((err) =>
      console.error("Embed failed for doc", doc.id, err),
    );
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

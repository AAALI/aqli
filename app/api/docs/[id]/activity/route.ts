import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDocActivity } from "@/lib/supabase/activity";
import { getDoc } from "@/lib/supabase/docs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // getDocActivity reads via the service-role client, so first prove the
  // caller can see this doc at all (RLS scopes getDoc to their workspaces).
  const doc = await getDoc(id).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const activities = await getDocActivity(id);
  return NextResponse.json({ activities });
}

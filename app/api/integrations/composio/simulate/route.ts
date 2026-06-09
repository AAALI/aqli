import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIntegrationConnection, upsertIntegrationConnection } from "@/lib/supabase/integration-connections";
import { processPullRequestData } from "@/lib/integrations/source/feature-doc";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.workspace_id || !body.event) {
    return NextResponse.json({ error: "workspace_id and event required" }, { status: 400 });
  }

  const existing = await getIntegrationConnection(body.workspace_id, "github");
  const connection = existing ?? await upsertIntegrationConnection({
    workspaceId: body.workspace_id,
    userId: user.id,
    provider: "github",
    status: "connected",
    defaultSpaceId: body.default_space_id ?? null,
    metadata: { simulated: true },
  });

  const result = await processPullRequestData(connection, body.event, { enrich: false });
  return NextResponse.json({ ok: true, result });
}

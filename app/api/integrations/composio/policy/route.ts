import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import {
  getIntegrationConnection,
  updateIntegrationConnection,
} from "@/lib/supabase/integration-connections";
import { getPostHogClient } from "@/lib/posthog-server";

// Toggle the GitHub auto-approve policy. When off, merged PRs still create or
// patch docs but route them to the review queue instead of publishing.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = body.workspace_id as string | undefined;
  const autoApprove = body.auto_approve;
  if (!workspaceId || typeof autoApprove !== "boolean")
    return NextResponse.json(
      { error: "workspace_id and auto_approve (boolean) required" },
      { status: 400 },
    );

  // Same rule as repo management: only workspace admins set integration policy
  // (the update path uses the service-role client under the hood).
  const role = await getMyRole(workspaceId);
  if (role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const connection = await getIntegrationConnection(workspaceId, "github");
  if (!connection)
    return NextResponse.json({ error: "GitHub is not connected" }, { status: 409 });

  await updateIntegrationConnection(connection.id, {
    metadata: { ...connection.metadata, auto_approve: autoApprove },
  });

  getPostHogClient().capture({
    distinctId: user.id,
    event: "github_auto_approve_toggled",
    properties: { workspace_id: workspaceId, auto_approve: autoApprove },
  });

  return NextResponse.json({ ok: true, auto_approve: autoApprove });
}

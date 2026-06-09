import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { getIntegrationConnection, updateIntegrationConnection } from "@/lib/supabase/integration-connections";
import { createGithubPullRequestTriggers } from "@/lib/integrations/source/composio";
import type { IntegrationProvider } from "@/types/integration";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const workspaceSlug = url.searchParams.get("workspace");
  const workspaceId = url.searchParams.get("workspace_id");
  const provider = url.searchParams.get("provider") as IntegrationProvider | null;
  const status = url.searchParams.get("status");
  const connectedAccountId = url.searchParams.get("connected_account_id");

  if (!workspaceSlug || !workspaceId || !provider) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  // The mutation below uses the service-role client; ensure the redirected
  // user is actually a workspace admin before we touch the row. (The OAuth
  // provider can be redirected to with any workspace_id query param.)
  const role = await getMyRole(workspaceId);
  if (role !== "admin") {
    return NextResponse.redirect(new URL(`/w/${workspaceSlug}/settings/integrations/${provider}?status=forbidden`, req.url));
  }

  const connection = await getIntegrationConnection(workspaceId, provider);
  if (!connection) return NextResponse.redirect(new URL(`/w/${workspaceSlug}/settings/integrations/${provider}`, req.url));

  if (status !== "success") {
    await updateIntegrationConnection(connection.id, {
      status: "failed",
      last_error: "Composio authorization failed or was cancelled.",
    });
    return NextResponse.redirect(new URL(`/w/${workspaceSlug}/settings/integrations/${provider}?status=failed`, req.url));
  }

  let triggerIds = connection.trigger_ids;
  let lastError: string | null = null;
  if (provider === "github") {
    const repos = readRepos(connection.metadata);
    try {
      triggerIds = await createGithubPullRequestTriggers(connection.composio_user_id, repos);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Failed to create GitHub PR triggers.";
    }
  }

  await updateIntegrationConnection(connection.id, {
    status: "connected",
    connected_account_id: connectedAccountId,
    trigger_ids: triggerIds,
    last_error: lastError,
  });

  return NextResponse.redirect(new URL(`/w/${workspaceSlug}/settings/integrations/${provider}?status=connected`, req.url));
}

function readRepos(metadata: Record<string, unknown>) {
  const repos = Array.isArray(metadata.repositories) ? metadata.repositories : [];
  return repos.flatMap((repo) => {
    if (!repo || typeof repo !== "object") return [];
    const rec = repo as Record<string, unknown>;
    return typeof rec.owner === "string" && typeof rec.repo === "string"
      ? [{ owner: rec.owner, repo: rec.repo }]
      : [];
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getIntegrationConnection,
  updateIntegrationConnection,
} from "@/lib/supabase/integration-connections";
import {
  listGithubRepos,
  createGithubPullRequestTriggers,
} from "@/lib/integrations/source/composio";

type RepoMeta = { owner: string; repo: string; full_name: string };

function toRepoMeta(fullName: string): RepoMeta | null {
  const [owner, repo] = fullName.split("/");
  return owner && repo ? { owner, repo, full_name: `${owner}/${repo}` } : null;
}

function existingRepoNames(metadata: Record<string, unknown>): string[] {
  const repos = Array.isArray(metadata.repositories) ? metadata.repositories : [];
  return repos.flatMap((r) =>
    r && typeof r === "object" && typeof (r as RepoMeta).full_name === "string"
      ? [(r as RepoMeta).full_name]
      : [],
  );
}

// List the repos the connected GitHub account can access.
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  const connection = await getIntegrationConnection(workspaceId, "github");
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "GitHub is not connected" }, { status: 409 });
  }

  try {
    const repos = await listGithubRepos(connection.composio_user_id);
    const selected = existingRepoNames(connection.metadata);
    return NextResponse.json({ repos, selected });
  } catch (err) {
    console.error("listGithubRepos failed:", err);
    return NextResponse.json({ error: "Failed to load repositories" }, { status: 502 });
  }
}

// Save the selected repos (+ default space) and create PR triggers for new ones.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = body.workspace_id as string | undefined;
  const repoNames = Array.isArray(body.repos) ? (body.repos as string[]) : [];
  const defaultSpaceId = (body.default_space_id as string | undefined) || null;
  if (!workspaceId)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  const connection = await getIntegrationConnection(workspaceId, "github");
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "GitHub is not connected" }, { status: 409 });
  }

  const selected = repoNames
    .map(toRepoMeta)
    .filter((r): r is RepoMeta => r !== null);

  // Only create triggers for repos that weren't already watched, so re-saving
  // doesn't pile up duplicate Composio triggers.
  const already = new Set(existingRepoNames(connection.metadata));
  const newRepos = selected.filter((r) => !already.has(r.full_name));

  let triggerIds = connection.trigger_ids;
  let lastError: string | null = null;
  try {
    if (newRepos.length > 0) {
      const created = await createGithubPullRequestTriggers(
        connection.composio_user_id,
        newRepos.map((r) => ({ owner: r.owner, repo: r.repo })),
      );
      triggerIds = [...connection.trigger_ids, ...created];
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : "Failed to create PR triggers";
  }

  const updated = await updateIntegrationConnection(connection.id, {
    metadata: { ...connection.metadata, repositories: selected },
    default_space_id: defaultSpaceId,
    trigger_ids: triggerIds,
    last_error: lastError,
  });

  return NextResponse.json({
    ok: lastError === null,
    saved: selected.map((r) => r.full_name),
    triggers: updated.trigger_ids.length,
    error: lastError,
  });
}

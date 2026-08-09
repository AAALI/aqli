import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import {
  getIntegrationConnection,
  getIntegrationSecret,
  updateIntegrationConnection,
} from "@/lib/supabase/integration-connections";
import {
  GithubError,
  createPullRequestHook,
  deleteHook,
  listRepos,
} from "@/lib/integrations/source/github";

type RepoMeta = { owner: string; repo: string; full_name: string };

function toRepoMeta(fullName: string): RepoMeta | null {
  const [owner, repo] = fullName.split("/");
  return owner && repo ? { owner, repo, full_name: `${owner}/${repo}` } : null;
}

function existingRepos(metadata: Record<string, unknown>): RepoMeta[] {
  const repos = Array.isArray(metadata.repositories) ? metadata.repositories : [];
  return repos.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const rec = r as Record<string, unknown>;
    return typeof rec.owner === "string" && typeof rec.repo === "string"
      ? [{ owner: rec.owner, repo: rec.repo, full_name: `${rec.owner}/${rec.repo}` }]
      : [];
  });
}

/** Repos the stored token can reach. */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = new URL(req.url).searchParams.get("workspace_id");
  if (!workspaceId)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  // Membership before reading: the response lists repository names reachable
  // by the workspace's token, which non-members must not see.
  const role = await getMyRole(workspaceId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const connection = await getIntegrationConnection(workspaceId, "github");
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "GitHub is not connected" }, { status: 409 });
  }

  const secret = await getIntegrationSecret(workspaceId, connection.id);
  if (!secret) {
    return NextResponse.json({ error: "No stored GitHub token" }, { status: 409 });
  }

  try {
    const repos = await listRepos(secret.access_token);
    return NextResponse.json({
      repos,
      selected: existingRepos(connection.metadata).map((r) => r.full_name),
    });
  } catch (err) {
    console.error("listRepos failed:", err);
    const message =
      err instanceof GithubError ? err.message : "Failed to load repositories";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Save the watched repos and reconcile the hooks to match.
 *
 * The Composio version only ever added triggers, so unchecking a repo left its
 * trigger running. Hooks are ours to delete now, so this removes the ones for
 * repos that were dropped.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const workspaceId = typeof body?.workspace_id === "string" ? body.workspace_id : "";
  const repoNames = Array.isArray(body?.repos)
    ? (body.repos as unknown[]).filter((r): r is string => typeof r === "string")
    : [];
  const defaultSpaceId =
    typeof body?.default_space_id === "string" && body.default_space_id
      ? body.default_space_id
      : null;

  if (!workspaceId)
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  const role = await getMyRole(workspaceId);
  if (role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const connection = await getIntegrationConnection(workspaceId, "github");
  if (!connection || connection.status !== "connected") {
    return NextResponse.json({ error: "GitHub is not connected" }, { status: 409 });
  }

  const secret = await getIntegrationSecret(workspaceId, connection.id);
  if (!secret) {
    return NextResponse.json({ error: "No stored GitHub token" }, { status: 409 });
  }

  const selected = repoNames.map(toRepoMeta).filter((r): r is RepoMeta => r !== null);
  const before = existingRepos(connection.metadata);
  const beforeNames = new Set(before.map((r) => r.full_name));
  const selectedNames = new Set(selected.map((r) => r.full_name));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const callbackUrl = new URL("/api/integrations/github/webhook", appUrl).toString();

  const failures: string[] = [];
  const hookIds = new Set(connection.github_hook_ids);

  // Add hooks for newly checked repos.
  for (const repo of selected) {
    if (beforeNames.has(repo.full_name)) continue;
    try {
      hookIds.add(
        await createPullRequestHook(secret.access_token, {
          owner: repo.owner,
          repo: repo.repo,
          callbackUrl,
          secret: secret.webhook_secret,
        }),
      );
    } catch (err) {
      const detail = err instanceof GithubError ? err.message : "unknown error";
      failures.push(`${repo.full_name} (${detail})`);
    }
  }

  // Remove hooks for repos that were unchecked. Best effort: a hook we cannot
  // delete is noise on someone's repo, not a correctness problem here — an
  // unknown hook id is rejected by the webhook route anyway.
  for (const repo of before) {
    if (selectedNames.has(repo.full_name)) continue;
    for (const hookId of connection.github_hook_ids) {
      await deleteHook(secret.access_token, repo.owner, repo.repo, hookId)
        .then(() => hookIds.delete(hookId))
        .catch(() => {
          /* hook belongs to another repo, or is already gone */
        });
    }
  }

  const lastError = failures.length
    ? `Could not watch ${failures.join(", ")}. The token needs admin:repo_hook on each repository.`
    : null;

  const updated = await updateIntegrationConnection(workspaceId, connection.id, {
    metadata: { ...connection.metadata, repositories: selected },
    default_space_id: defaultSpaceId,
    github_hook_ids: [...hookIds],
    last_error: lastError,
  });

  return NextResponse.json({
    ok: lastError === null,
    saved: selected.map((r) => r.full_name),
    watching: updated.github_hook_ids.length,
    error: lastError,
  });
}

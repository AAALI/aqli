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
/** A repo with a live hook. `hook_id` is what makes removal a targeted delete. */
type WatchedRepo = RepoMeta & { hook_id: number };

function toRepoMeta(fullName: string): RepoMeta | null {
  const [owner, repo] = fullName.split("/");
  return owner && repo ? { owner, repo, full_name: `${owner}/${repo}` } : null;
}

/** Repos with a confirmed hook. Written only after `createPullRequestHook`. */
function watchedRepos(metadata: Record<string, unknown>): WatchedRepo[] {
  const repos = Array.isArray(metadata.repositories) ? metadata.repositories : [];
  return repos.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const rec = r as Record<string, unknown>;
    if (typeof rec.owner !== "string" || typeof rec.repo !== "string") return [];
    return [{
      owner: rec.owner,
      repo: rec.repo,
      full_name: `${rec.owner}/${rec.repo}`,
      // Rows written before hook ids were recorded per repo have none. Treated
      // as unremovable rather than guessed at, which is the safe direction:
      // a stale hook is noise, a wrongly deleted one silently stops a workspace.
      hook_id: typeof rec.hook_id === "number" ? rec.hook_id : -1,
    }];
  });
}

/** Selected but not watched — hook creation failed and a re-save retries it. */
function pendingRepos(metadata: Record<string, unknown>): string[] {
  const list = Array.isArray(metadata.pending_repositories) ? metadata.pending_repositories : [];
  return list.filter((r): r is string => typeof r === "string");
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
    const watching = watchedRepos(connection.metadata).map((r) => r.full_name);
    const pending = pendingRepos(connection.metadata);
    return NextResponse.json({
      repos,
      // Pending repos stay ticked: the admin chose them, and unticking them
      // silently would hide the fact that the hook never got created.
      selected: [...watching, ...pending],
      watching,
      pending,
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
  const selectedNames = new Set(selected.map((r) => r.full_name));
  const before = watchedRepos(connection.metadata);
  const stillWatched = before.filter((r) => selectedNames.has(r.full_name));
  const watchedNames = new Set(before.map((r) => r.full_name));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const callbackUrl = new URL("/api/integrations/github/webhook", appUrl).toString();

  const watched: WatchedRepo[] = [...stillWatched];
  const pending: string[] = [];
  const failures: string[] = [];

  // Add hooks for repos that are selected but not already watched. That set
  // includes last save's pending ones, so re-saving is the retry.
  for (const repo of selected) {
    if (watchedNames.has(repo.full_name)) continue;
    try {
      const hookId = await createPullRequestHook(secret.access_token, {
        owner: repo.owner,
        repo: repo.repo,
        callbackUrl,
        secret: secret.webhook_secret,
      });
      watched.push({ ...repo, hook_id: hookId });
    } catch (err) {
      const detail = err instanceof GithubError ? err.message : "unknown error";
      failures.push(`${repo.full_name} (${detail})`);
      pending.push(repo.full_name);
    }
  }

  // Remove hooks for repos that were unticked — one targeted delete each, now
  // that the hook id is stored against its repo. The previous version tried
  // every id in the connection against every removed repo, which is O(n*m)
  // requests and could delete a hook belonging to a repo still being watched.
  //
  // A repo stays in `watched` unless GitHub confirms the hook is gone. Keeping
  // a stale id is harmless noise; dropping one that still exists means its
  // deliveries stop resolving to this workspace and start 404ing.
  for (const repo of before) {
    if (selectedNames.has(repo.full_name)) continue;
    if (repo.hook_id < 0) continue; // pre-dates per-repo hook ids; nothing to target
    try {
      await deleteHook(secret.access_token, repo.owner, repo.repo, repo.hook_id);
    } catch (err) {
      console.error(`could not delete hook ${repo.hook_id} on ${repo.full_name}:`, err);
      watched.push(repo);
    }
  }

  const lastError = failures.length
    ? `Could not watch ${failures.join(", ")}. The token needs admin:repo_hook on each repository.`
    : null;

  const updated = await updateIntegrationConnection(workspaceId, connection.id, {
    metadata: {
      ...connection.metadata,
      repositories: watched,
      pending_repositories: pending,
    },
    default_space_id: defaultSpaceId,
    github_hook_ids: watched.map((r) => r.hook_id).filter((id) => id >= 0),
    last_error: lastError,
  });

  return NextResponse.json({
    ok: lastError === null,
    saved: watched.map((r) => r.full_name),
    pending,
    watching: updated.github_hook_ids.length,
    error: lastError,
  });
}

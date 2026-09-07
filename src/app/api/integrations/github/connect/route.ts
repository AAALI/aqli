import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import {
  saveIntegrationSecret,
  updateIntegrationConnection,
  upsertIntegrationConnection,
} from "@/lib/supabase/integration-connections";
import {
  GithubError,
  createPullRequestHook,
  newWebhookSecret,
  verifyToken,
} from "@/lib/integrations/source/github";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * Connect GitHub with a personal access token.
 *
 * Replaces the Composio OAuth round trip (`/api/integrations/composio/connect`
 * plus its callback). A token is a worse first impression than a consent
 * screen, and it is the trade: no hosted OAuth means no second vendor, no
 * second API key for a self-hoster to obtain, and 294 KiB back in the worker.
 *
 * The token needs `repo` scope to read pull requests and `admin:repo_hook` to
 * register the webhook.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const workspaceId = typeof body?.workspace_id === "string" ? body.workspace_id : "";
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const defaultSpaceId =
    typeof body?.default_space_id === "string" && body.default_space_id
      ? body.default_space_id
      : null;
  const repos = parseRepos(body?.repos);

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }
  if (!token) {
    return NextResponse.json({ error: "A GitHub token is required." }, { status: 400 });
  }

  // The writes below go through the service client, which bypasses RLS. Match
  // the `workspace admins can manage integration connections` policy here.
  const role = await getMyRole(workspaceId);
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check the token before storing it, so a typo is an error message rather
  // than a connection that looks fine and never fires.
  let login: string;
  try {
    ({ login } = await verifyToken(token));
  } catch (err) {
    const message =
      err instanceof GithubError
        ? `GitHub rejected that token: ${err.message}`
        : "Could not reach GitHub to check that token.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // `repositories` is written after the hooks are created, not here. It means
  // "we are watching this", and a repo whose hook failed is not being watched —
  // recording it up front made the settings page claim coverage that did not
  // exist, and made a retry look like a no-op because the repo already appeared
  // in the saved list.
  const connection = await upsertIntegrationConnection({
    workspaceId,
    userId: user.id,
    provider: "github",
    status: "initiated",
    defaultSpaceId,
    metadata: { github_login: login },
  });

  // One secret per connection, so one workspace's secret cannot validate
  // another's deliveries. Reconnecting rotates it, which is why the old hooks
  // are not reused.
  const webhookSecret = newWebhookSecret();
  await saveIntegrationSecret({
    workspaceId,
    connectionId: connection.id,
    accessToken: token,
    webhookSecret,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const callbackUrl = new URL("/api/integrations/github/webhook", appUrl).toString();

  const watched: WatchedRepo[] = [];
  const pending: string[] = [];
  const failures: string[] = [];
  for (const repo of repos) {
    try {
      const hookId = await createPullRequestHook(token, {
        owner: repo.owner,
        repo: repo.repo,
        callbackUrl,
        secret: webhookSecret,
      });
      // The hook id is kept against the repo that owns it, not only in the flat
      // `github_hook_ids` array, so removing one later is a targeted delete
      // rather than trying every id against every repo.
      watched.push({ ...repo, hook_id: hookId });
    } catch (err) {
      // Creating a hook needs admin on the repo, and GitHub answers a token
      // without it with 404 rather than 403. Report per repo instead of
      // concluding the token is bad.
      const detail = err instanceof GithubError ? err.message : "unknown error";
      failures.push(`${repo.full_name} (${detail})`);
      pending.push(repo.full_name);
    }
  }

  const lastError = failures.length
    ? `Could not watch ${failures.join(", ")}. The token needs admin:repo_hook on each repository.`
    : null;

  await updateIntegrationConnection(workspaceId, connection.id, {
    status: "connected",
    github_hook_ids: watched.map((r) => r.hook_id),
    // Selected but unwatched, kept apart from `repositories` so the picker can
    // show them still ticked and a re-save retries them.
    metadata: { ...connection.metadata, repositories: watched, pending_repositories: pending },
    last_error: lastError,
  });

  getPostHogClient().capture({
    distinctId: user.id,
    event: "integration_connected",
    properties: {
      provider: "github",
      workspace_id: workspaceId,
      repos: repos.length,
      has_error: Boolean(lastError),
    },
  });

  return NextResponse.json({
    ok: failures.length === 0,
    login,
    watching: watched.length,
    error: lastError,
  });
}

type WatchedRepo = { owner: string; repo: string; full_name: string; hook_id: number };

function parseRepos(value: unknown): { owner: string; repo: string; full_name: string }[] {
  const names = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
  return names.flatMap((fullName) => {
    const [owner, repo] = fullName.trim().split("/");
    return owner && repo ? [{ owner, repo, full_name: `${owner}/${repo}` }] : [];
  });
}

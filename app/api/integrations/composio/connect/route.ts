import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getMyRole } from "@/lib/supabase/members";
import { createConnectLink } from "@/lib/integrations/source/composio";
import {
  composioUserId,
  upsertIntegrationConnection,
} from "@/lib/supabase/integration-connections";
import type { IntegrationProvider } from "@/types/integration";
import { getPostHogClient } from "@/lib/posthog-server";

const PROVIDERS = new Set(["github", "linear"]);

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const input = await readInput(req);
  const provider = input.provider as IntegrationProvider;
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }
  if (!input.workspace_id || !input.workspace_slug) {
    return NextResponse.json({ error: "workspace_id and workspace_slug required" }, { status: 400 });
  }

  // The mutation path uses a service-role client under the hood, which bypasses
  // RLS. Explicitly verify the caller is a workspace admin (matching the
  // `workspace admins can manage integration connections` policy) so this
  // endpoint can't be used to write connections for an arbitrary workspace.
  const role = await getMyRole(input.workspace_id);
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const repos = provider === "github" ? parseRepos(input.repo_full_name) : [];
  const metadata = provider === "github" ? { repositories: repos } : {};

  await upsertIntegrationConnection({
    workspaceId: input.workspace_id,
    userId: user.id,
    provider,
    status: "initiated",
    defaultSpaceId: input.default_space_id || null,
    metadata,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const callbackUrl = new URL("/api/integrations/composio/callback", appUrl);
  callbackUrl.searchParams.set("workspace", input.workspace_slug);
  callbackUrl.searchParams.set("workspace_id", input.workspace_id);
  callbackUrl.searchParams.set("provider", provider);

  const redirectUrl = await createConnectLink({
    composioUserId: composioUserId(input.workspace_id, user.id),
    provider,
    callbackUrl: callbackUrl.toString(),
  });
  if (!redirectUrl) {
    return NextResponse.json({ error: "Composio did not return a redirect URL" }, { status: 502 });
  }

  getPostHogClient().capture({
    distinctId: user.id,
    event: "integration_connect_initiated",
    properties: { provider, workspace_id: input.workspace_id },
  });

  if (input.__form === "true") return NextResponse.redirect(redirectUrl, 303);
  return NextResponse.json({ redirect_url: redirectUrl });
}

async function readInput(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await req.json()) as Record<string, string>;
  }
  const form = await req.formData();
  return Object.fromEntries(form.entries()) as Record<string, string>;
}

function parseRepos(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((repo) => repo.trim())
    .filter(Boolean)
    .flatMap((fullName) => {
      const [owner, repo] = fullName.split("/");
      return owner && repo ? [{ owner, repo, full_name: `${owner}/${repo}` }] : [];
    });
}

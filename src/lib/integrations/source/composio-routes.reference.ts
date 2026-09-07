/**
 * The four Composio API routes, retained as a commented reference.
 *
 * They used to live under `app/api/integrations/composio/` as commented-out
 * `route.ts` files. That did not do what the handover claimed: Next still
 * registers a route for any `route.ts` under `app/`, so the endpoints kept
 * answering — `/api/integrations/composio/webhook` returned 405, not 404, and
 * anything still pointing at it looked half-alive.
 *
 * Moving them here makes the URLs genuinely gone while keeping the code, which
 * is the point of a soft swap. Restoring means recreating the route files and
 * `pnpm add @composio/core`; see `./composio.ts` for the call mapping.
 *
 * `policy` and `simulate` are NOT here — they never used the SDK and are still
 * live routes.
 */

export {};

// ===========================================================================
// app/api/integrations/composio/connect/route.ts
// ===========================================================================
//
// import { NextRequest, NextResponse } from "next/server";
// import { createServerSupabaseClient } from "@/lib/supabase/server";
// import { getMyRole } from "@/lib/supabase/members";
// import { createConnectLink } from "@/lib/integrations/source/composio";
// import {
//   composioUserId,
//   upsertIntegrationConnection,
// } from "@/lib/supabase/integration-connections";
// import type { IntegrationProvider } from "@/types/integration";
// import { getPostHogClient } from "@/lib/posthog-server";
//
// const PROVIDERS = new Set(["github", "linear"]);
//
// export async function POST(req: NextRequest) {
//   const supabase = await createServerSupabaseClient();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();
//   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//
//   const input = await readInput(req);
//   const provider = input.provider as IntegrationProvider;
//   if (!PROVIDERS.has(provider)) {
//     return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
//   }
//   if (!input.workspace_id || !input.workspace_slug) {
//     return NextResponse.json({ error: "workspace_id and workspace_slug required" }, { status: 400 });
//   }
//
//   // The mutation path uses a service-role client under the hood, which bypasses
//   // RLS. Explicitly verify the caller is a workspace admin (matching the
//   // `workspace admins can manage integration connections` policy) so this
//   // endpoint can't be used to write connections for an arbitrary workspace.
//   const role = await getMyRole(input.workspace_id);
//   if (role !== "admin") {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }
//
//   const repos = provider === "github" ? parseRepos(input.repo_full_name) : [];
//   const metadata = provider === "github" ? { repositories: repos } : {};
//
//   await upsertIntegrationConnection({
//     workspaceId: input.workspace_id,
//     userId: user.id,
//     provider,
//     status: "initiated",
//     defaultSpaceId: input.default_space_id || null,
//     metadata,
//   });
//
//   const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
//   const callbackUrl = new URL("/api/integrations/composio/callback", appUrl);
//   callbackUrl.searchParams.set("workspace", input.workspace_slug);
//   callbackUrl.searchParams.set("workspace_id", input.workspace_id);
//   callbackUrl.searchParams.set("provider", provider);
//
//   const redirectUrl = await createConnectLink({
//     composioUserId: composioUserId(input.workspace_id, user.id),
//     provider,
//     callbackUrl: callbackUrl.toString(),
//   });
//   if (!redirectUrl) {
//     return NextResponse.json({ error: "Composio did not return a redirect URL" }, { status: 502 });
//   }
//
//   getPostHogClient().capture({
//     distinctId: user.id,
//     event: "integration_connect_initiated",
//     properties: { provider, workspace_id: input.workspace_id },
//   });
//
//   if (input.__form === "true") return NextResponse.redirect(redirectUrl, 303);
//   return NextResponse.json({ redirect_url: redirectUrl });
// }
//
// async function readInput(req: NextRequest) {
//   const contentType = req.headers.get("content-type") ?? "";
//   if (contentType.includes("application/json")) {
//     return (await req.json()) as Record<string, string>;
//   }
//   const form = await req.formData();
//   return Object.fromEntries(form.entries()) as Record<string, string>;
// }
//
// function parseRepos(value?: string) {
//   if (!value) return [];
//   return value
//     .split(",")
//     .map((repo) => repo.trim())
//     .filter(Boolean)
//     .flatMap((fullName) => {
//       const [owner, repo] = fullName.split("/");
//       return owner && repo ? [{ owner, repo, full_name: `${owner}/${repo}` }] : [];
//     });
// }
//

// ===========================================================================
// app/api/integrations/composio/callback/route.ts
// ===========================================================================
//
// import { NextRequest, NextResponse } from "next/server";
// import { createServerSupabaseClient } from "@/lib/supabase/server";
// import { getMyRole } from "@/lib/supabase/members";
// import { getIntegrationConnection, updateIntegrationConnection } from "@/lib/supabase/integration-connections";
// import { createGithubPullRequestTriggers } from "@/lib/integrations/source/composio";
// import type { IntegrationProvider } from "@/types/integration";
// import { getPostHogClient } from "@/lib/posthog-server";
//
// export async function GET(req: NextRequest) {
//   const url = new URL(req.url);
//   const workspaceSlug = url.searchParams.get("workspace");
//   const workspaceId = url.searchParams.get("workspace_id");
//   const provider = url.searchParams.get("provider") as IntegrationProvider | null;
//   const status = url.searchParams.get("status");
//   const connectedAccountId = url.searchParams.get("connected_account_id");
//
//   if (!workspaceSlug || !workspaceId || !provider) {
//     return NextResponse.redirect(new URL("/login", req.url));
//   }
//
//   const supabase = await createServerSupabaseClient();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();
//   if (!user) return NextResponse.redirect(new URL("/login", req.url));
//
//   // The mutation below uses the service-role client; ensure the redirected
//   // user is actually a workspace admin before we touch the row. (The OAuth
//   // provider can be redirected to with any workspace_id query param.)
//   const role = await getMyRole(workspaceId);
//   if (role !== "admin") {
//     return NextResponse.redirect(new URL(`/w/${workspaceSlug}/settings/integrations/${provider}?status=forbidden`, req.url));
//   }
//
//   const connection = await getIntegrationConnection(workspaceId, provider);
//   if (!connection) return NextResponse.redirect(new URL(`/w/${workspaceSlug}/settings/integrations/${provider}`, req.url));
//
//   if (status !== "success") {
//     await updateIntegrationConnection(connection.workspace_id, connection.id, {
//       status: "failed",
//       last_error: "Composio authorization failed or was cancelled.",
//     });
//     return NextResponse.redirect(new URL(`/w/${workspaceSlug}/settings/integrations/${provider}?status=failed`, req.url));
//   }
//
//   let triggerIds = connection.trigger_ids;
//   let lastError: string | null = null;
//   if (provider === "github") {
//     const repos = readRepos(connection.metadata);
//     try {
//       triggerIds = await createGithubPullRequestTriggers(connection.composio_user_id, repos);
//     } catch (err) {
//       lastError = err instanceof Error ? err.message : "Failed to create GitHub PR triggers.";
//     }
//   }
//
//   await updateIntegrationConnection(connection.workspace_id, connection.id, {
//     status: "connected",
//     connected_account_id: connectedAccountId,
//     trigger_ids: triggerIds,
//     last_error: lastError,
//   });
//
//   getPostHogClient().capture({
//     distinctId: user.id,
//     event: "integration_connected",
//     properties: { provider, workspace_id: workspaceId, has_error: !!lastError },
//   });
//
//   return NextResponse.redirect(new URL(`/w/${workspaceSlug}/settings/integrations/${provider}?status=connected`, req.url));
// }
//
// function readRepos(metadata: Record<string, unknown>) {
//   const repos = Array.isArray(metadata.repositories) ? metadata.repositories : [];
//   return repos.flatMap((repo) => {
//     if (!repo || typeof repo !== "object") return [];
//     const rec = repo as Record<string, unknown>;
//     return typeof rec.owner === "string" && typeof rec.repo === "string"
//       ? [{ owner: rec.owner, repo: rec.repo }]
//       : [];
//   });
// }
//

// ===========================================================================
// app/api/integrations/composio/repos/route.ts
// ===========================================================================
//
// import { NextRequest, NextResponse } from "next/server";
// import { createServerSupabaseClient } from "@/lib/supabase/server";
// import { getMyRole } from "@/lib/supabase/members";
// import {
//   getIntegrationConnection,
//   updateIntegrationConnection,
// } from "@/lib/supabase/integration-connections";
// import {
//   listGithubRepos,
//   createGithubPullRequestTriggers,
// } from "@/lib/integrations/source/composio";
//
// type RepoMeta = { owner: string; repo: string; full_name: string };
//
// function toRepoMeta(fullName: string): RepoMeta | null {
//   const [owner, repo] = fullName.split("/");
//   return owner && repo ? { owner, repo, full_name: `${owner}/${repo}` } : null;
// }
//
// function existingRepoNames(metadata: Record<string, unknown>): string[] {
//   const repos = Array.isArray(metadata.repositories) ? metadata.repositories : [];
//   return repos.flatMap((r) =>
//     r && typeof r === "object" && typeof (r as RepoMeta).full_name === "string"
//       ? [(r as RepoMeta).full_name]
//       : [],
//   );
// }
//
// // List the repos the connected GitHub account can access.
// export async function GET(req: NextRequest) {
//   const supabase = await createServerSupabaseClient();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();
//   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//
//   const workspaceId = new URL(req.url).searchParams.get("workspace_id");
//   if (!workspaceId)
//     return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
//
//   // Verify membership before reading — the connection lookup uses the
//   // request-scoped client but `listGithubRepos` exposes repository names
//   // for the workspace's connected account, which non-members must not see.
//   const role = await getMyRole(workspaceId);
//   if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//
//   const connection = await getIntegrationConnection(workspaceId, "github");
//   if (!connection || connection.status !== "connected") {
//     return NextResponse.json({ error: "GitHub is not connected" }, { status: 409 });
//   }
//
//   try {
//     const repos = await listGithubRepos(connection.composio_user_id);
//     const selected = existingRepoNames(connection.metadata);
//     return NextResponse.json({ repos, selected });
//   } catch (err) {
//     console.error("listGithubRepos failed:", err);
//     return NextResponse.json({ error: "Failed to load repositories" }, { status: 502 });
//   }
// }
//
// // Save the selected repos (+ default space) and create PR triggers for new ones.
// export async function POST(req: NextRequest) {
//   const supabase = await createServerSupabaseClient();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();
//   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//
//   const body = await req.json();
//   const workspaceId = body.workspace_id as string | undefined;
//   const repoNames = Array.isArray(body.repos) ? (body.repos as string[]) : [];
//   const defaultSpaceId = (body.default_space_id as string | undefined) || null;
//   if (!workspaceId)
//     return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
//
//   // Match the RLS policy: only workspace admins can manage the connection
//   // (and so create Composio PR triggers / change the default space).
//   const role = await getMyRole(workspaceId);
//   if (role !== "admin")
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//
//   const connection = await getIntegrationConnection(workspaceId, "github");
//   if (!connection || connection.status !== "connected") {
//     return NextResponse.json({ error: "GitHub is not connected" }, { status: 409 });
//   }
//
//   const selected = repoNames
//     .map(toRepoMeta)
//     .filter((r): r is RepoMeta => r !== null);
//
//   // Only create triggers for repos that weren't already watched, so re-saving
//   // doesn't pile up duplicate Composio triggers.
//   const already = new Set(existingRepoNames(connection.metadata));
//   const newRepos = selected.filter((r) => !already.has(r.full_name));
//
//   let triggerIds = connection.trigger_ids;
//   let lastError: string | null = null;
//   try {
//     if (newRepos.length > 0) {
//       const created = await createGithubPullRequestTriggers(
//         connection.composio_user_id,
//         newRepos.map((r) => ({ owner: r.owner, repo: r.repo })),
//       );
//       triggerIds = [...connection.trigger_ids, ...created];
//     }
//   } catch (err) {
//     lastError = err instanceof Error ? err.message : "Failed to create PR triggers";
//   }
//
//   const updated = await updateIntegrationConnection(connection.workspace_id, connection.id, {
//     metadata: { ...connection.metadata, repositories: selected },
//     default_space_id: defaultSpaceId,
//     trigger_ids: triggerIds,
//     last_error: lastError,
//   });
//
//   return NextResponse.json({
//     ok: lastError === null,
//     saved: selected.map((r) => r.full_name),
//     triggers: updated.trigger_ids.length,
//     error: lastError,
//   });
// }
//

// ===========================================================================
// app/api/integrations/composio/webhook/route.ts
// ===========================================================================
//
// import { NextRequest, NextResponse } from "next/server";
// import { getCloudflareContext } from "@opennextjs/cloudflare";
// import { processComposioWebhookPayload } from "@/lib/integrations/source/feature-doc";
// import { verifyComposioWebhook } from "@/lib/integrations/source/composio";
// import { claimWebhookEvent, finishWebhookEvent } from "@/lib/supabase/integration-webhook-events";
// import type { IntegrationProvider } from "@/types/integration";
// import { getPostHogClient } from "@/lib/posthog-server";
//
// export const dynamic = "force-dynamic";
//
// export async function POST(req: NextRequest) {
//   const payload = await req.text();
//   const webhookId = req.headers.get("webhook-id") ?? "";
//   // Log identifiers only — payloads carry PR titles/bodies that don't belong
//   // in production logs.
//   console.log("[composio webhook] received", webhookId, `${payload.length} bytes`);
//
//   // 1) Signature verification. A failure here is genuinely a 401 (Composio
//   //    won't retry an unsigned/forged delivery).
//   let verified: unknown;
//   try {
//     verified = await verifyComposioWebhook({
//       id: webhookId,
//       timestamp: req.headers.get("webhook-timestamp") ?? "",
//       signature: req.headers.get("webhook-signature") ?? "",
//       payload,
//     });
//   } catch (err) {
//     const message = err instanceof Error ? err.message : "Invalid webhook";
//     if (message.includes("SECRET")) {
//       return NextResponse.json({ error: message }, { status: 500 });
//     }
//     return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
//   }
//
//   const event = readPayload(verified);
//   const provider = inferProvider(event);
//   const triggerSlug = readTriggerSlug(event);
//
//   // 2) Idempotency claim. If we've already seen this `webhook-id`, ack 200
//   //    immediately without redoing the heavy pipeline. Composio retries the
//   //    same id whenever it doesn't see 2xx in time, which is what produced
//   //    the duplicate doc versions we just debugged.
//   if (webhookId && provider) {
//     let claim;
//     try {
//       claim = await claimWebhookEvent({ webhookId, provider, triggerSlug });
//     } catch (err) {
//       console.error("[composio webhook] claim failed; processing inline", err);
//       return processInline(event);
//     }
//
//     if (claim.status === "already_processed") {
//       console.log("[composio webhook] dedup hit", webhookId, claim.existing.status);
//       return NextResponse.json({ ok: true, dedup: true, existing: claim.existing });
//     }
//
//     // 3) Ack fast + run the pipeline in the background so Composio doesn't
//     //    cancel-and-retry while we call OpenAI / GitHub / Supabase.
//     const eventId = claim.id;
//     const { ctx } = await getCloudflareContext({ async: true });
//     ctx.waitUntil(processInBackground(eventId, event));
//     return NextResponse.json({ ok: true, queued: true, event_id: eventId });
//   }
//
//   // Fallback: no webhook id or unknown provider — process inline so we
//   // never silently drop a real delivery.
//   return processInline(event);
// }
//
// async function processInBackground(eventId: string, event: unknown) {
//   try {
//     const result = await processComposioWebhookPayload(
//       event as Parameters<typeof processComposioWebhookPayload>[0],
//       { webhookEventId: eventId },
//     );
//     console.log("[composio webhook] result", eventId, JSON.stringify(result));
//     await finishWebhookEvent({
//       id: eventId,
//       status: result.ignored ? "ignored" : "done",
//       result,
//     });
//     if (!result.ignored) {
//       getPostHogClient().capture({
//         distinctId: "system",
//         event: "webhook_doc_generated",
//         properties: { event_id: eventId, provider: inferProvider(event) },
//       });
//     }
//   } catch (err) {
//     const message = err instanceof Error ? err.message : "Unknown error";
//     console.error("[composio webhook] background failed", eventId, err);
//     await finishWebhookEvent({ id: eventId, status: "error", lastError: message });
//   }
// }
//
// async function processInline(event: unknown) {
//   try {
//     const result = await processComposioWebhookPayload(event as Parameters<typeof processComposioWebhookPayload>[0]);
//     console.log("[composio webhook] inline result", JSON.stringify(result));
//     return NextResponse.json({ ok: true, result });
//   } catch (err) {
//     console.error("[composio webhook] inline processing failed", err);
//     return NextResponse.json({ error: "Processing failed" }, { status: 500 });
//   }
// }
//
// function readPayload(value: unknown) {
//   if (value && typeof value === "object" && "payload" in value) {
//     return (value as { payload: unknown }).payload;
//   }
//   return value;
// }
//
// function asRecord(value: unknown): Record<string, unknown> | null {
//   return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
// }
//
// function readString(record: Record<string, unknown> | null, key: string): string | null {
//   if (!record) return null;
//   const v = record[key];
//   return typeof v === "string" && v.length > 0 ? v : null;
// }
//
// /**
//  * `verifyWebhook` returns a normalized `IncomingTriggerPayload` with camelCase
//  * keys (`toolkitSlug` / `triggerSlug`, top-level and under `metadata`) — not
//  * the raw V3 envelope's `metadata.trigger_slug`. Check every known location so
//  * the claim/fast-ack path actually engages; the snake_case fallback covers a
//  * raw envelope in case the SDK ever passes one through unnormalized.
//  */
// function readTriggerSlug(event: unknown): string | null {
//   const record = asRecord(event);
//   const metadata = asRecord(record?.metadata);
//   return (
//     readString(record, "triggerSlug") ??
//     readString(metadata, "triggerSlug") ??
//     readString(metadata, "trigger_slug")
//   );
// }
//
// function inferProvider(event: unknown): IntegrationProvider | null {
//   const record = asRecord(event);
//   const metadata = asRecord(record?.metadata);
//   const slug = (
//     readString(record, "toolkitSlug") ??
//     readString(metadata, "toolkitSlug") ??
//     readTriggerSlug(event) ??
//     ""
//   ).toLowerCase();
//   if (slug.startsWith("github")) return "github";
//   if (slug.startsWith("linear")) return "linear";
//   return null;
// }
//

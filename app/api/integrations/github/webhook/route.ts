import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { processGithubWebhookPayload } from "@/lib/integrations/source/feature-doc";
import {
  getIntegrationSecret,
  getServiceIntegrationByHookId,
} from "@/lib/supabase/integration-connections";
import { verifyWebhookSignature } from "@/lib/integrations/source/github";
import {
  claimWebhookEvent,
  finishWebhookEvent,
} from "@/lib/supabase/integration-webhook-events";
import { getPostHogClient } from "@/lib/posthog-server";

export const dynamic = "force-dynamic";

/**
 * Inbound `pull_request` deliveries from a repo webhook we registered.
 *
 * Replaces `/api/integrations/composio/webhook`. The shape of the handler is
 * unchanged — verify, claim for idempotency, ack fast, process in the
 * background — because none of that was Composio-specific. What changed is
 * that the delivery is GitHub's own documented payload rather than an envelope
 * that had to be searched for the event inside it.
 */
export async function POST(req: NextRequest) {
  // The raw body, not parsed JSON: the signature is over these exact bytes, and
  // re-serialising changes whitespace and key order and invalidates the digest.
  const payload = await req.text();

  const event = req.headers.get("x-github-event") ?? "";
  const deliveryId = req.headers.get("x-github-delivery") ?? "";
  const hookId = Number(req.headers.get("x-github-hook-id") ?? "");
  const signature = req.headers.get("x-hub-signature-256");

  // Identifiers only — payloads carry PR titles and bodies that don't belong
  // in production logs.
  console.log("[github webhook] received", deliveryId, event, `${payload.length} bytes`);

  if (!Number.isFinite(hookId) || hookId <= 0) {
    return NextResponse.json({ error: "Missing hook id" }, { status: 400 });
  }

  // GitHub sends a `ping` when a hook is created. Acknowledge it — a non-2xx
  // here shows up in the repo's webhook settings as a broken integration.
  if (event === "ping") return NextResponse.json({ ok: true, pong: true });

  if (event !== "pull_request") {
    return NextResponse.json({ ok: true, ignored: true, reason: "unsupported_event", event });
  }

  // Which connection registered this hook. Unverified at this point, so it is
  // used for nothing but fetching the secret to verify against.
  const connection = await getServiceIntegrationByHookId(hookId, "github").catch(() => null);
  if (!connection) {
    // Genuinely unknown hook — most likely one left behind on a repo after a
    // workspace disconnected. 404 rather than 401: there is nothing to verify.
    return NextResponse.json({ error: "Unknown hook" }, { status: 404 });
  }

  const secret = await getIntegrationSecret(connection.workspace_id, connection.id).catch(
    () => null,
  );
  if (!secret) {
    console.error("[github webhook] no stored secret for connection", connection.id);
    return NextResponse.json({ error: "Integration is not configured" }, { status: 500 });
  }

  const valid = await verifyWebhookSignature({
    payload,
    signature,
    secret: secret.webhook_secret,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  // Idempotency. GitHub redelivers the same `X-GitHub-Delivery` when it does
  // not see a 2xx in time, which is what produced duplicate doc versions on
  // the Composio path.
  if (deliveryId) {
    let claim;
    try {
      claim = await claimWebhookEvent({
        webhookId: deliveryId,
        provider: "github",
        triggerSlug: "pull_request",
      });
    } catch (err) {
      console.error("[github webhook] claim failed; processing inline", err);
      return processInline(hookId, parsed);
    }

    if (claim.status === "already_processed") {
      console.log("[github webhook] dedup hit", deliveryId, claim.existing.status);
      return NextResponse.json({ ok: true, dedup: true, existing: claim.existing });
    }

    // Ack fast and run the pipeline afterwards, so GitHub's 10-second delivery
    // timeout doesn't cancel-and-retry while we call OpenAI and Supabase.
    const eventId = claim.id;
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(processInBackground(eventId, hookId, parsed));
    return NextResponse.json({ ok: true, queued: true, event_id: eventId });
  }

  return processInline(hookId, parsed);
}

async function processInBackground(
  eventId: string,
  hookId: number,
  payload: Record<string, unknown>,
) {
  try {
    const result = await processGithubWebhookPayload(hookId, payload, {
      webhookEventId: eventId,
    });
    console.log("[github webhook] result", eventId, JSON.stringify(result));
    await finishWebhookEvent({
      id: eventId,
      status: result.ignored ? "ignored" : "done",
      result,
    });
    if (!result.ignored) {
      getPostHogClient().capture({
        distinctId: "system",
        event: "webhook_doc_generated",
        properties: { event_id: eventId, provider: "github" },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[github webhook] background failed", eventId, err);
    await finishWebhookEvent({ id: eventId, status: "error", lastError: message });
  }
}

async function processInline(hookId: number, payload: Record<string, unknown>) {
  try {
    const result = await processGithubWebhookPayload(hookId, payload);
    console.log("[github webhook] inline result", JSON.stringify(result));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[github webhook] inline processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

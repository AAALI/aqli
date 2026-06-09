import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { processComposioWebhookPayload } from "@/lib/integrations/source/feature-doc";
import { verifyComposioWebhook } from "@/lib/integrations/source/composio";
import { claimWebhookEvent, finishWebhookEvent } from "@/lib/supabase/integration-webhook-events";
import type { IntegrationProvider } from "@/types/integration";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const webhookId = req.headers.get("webhook-id") ?? "";
  console.log("[composio webhook] received", webhookId, payload.slice(0, 600));

  // 1) Signature verification. A failure here is genuinely a 401 (Composio
  //    won't retry an unsigned/forged delivery).
  let verified: unknown;
  try {
    verified = await verifyComposioWebhook({
      id: webhookId,
      timestamp: req.headers.get("webhook-timestamp") ?? "",
      signature: req.headers.get("webhook-signature") ?? "",
      payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook";
    if (message.includes("SECRET")) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = readPayload(verified);
  const provider = inferProvider(event);
  const triggerSlug = readString(asRecord(asRecord(event)?.metadata), "trigger_slug");

  // 2) Idempotency claim. If we've already seen this `webhook-id`, ack 200
  //    immediately without redoing the heavy pipeline. Composio retries the
  //    same id whenever it doesn't see 2xx in time, which is what produced
  //    the duplicate doc versions we just debugged.
  if (webhookId && provider) {
    let claim;
    try {
      claim = await claimWebhookEvent({ webhookId, provider, triggerSlug });
    } catch (err) {
      console.error("[composio webhook] claim failed; processing inline", err);
      return processInline(event);
    }

    if (claim.status === "already_processed") {
      console.log("[composio webhook] dedup hit", webhookId, claim.existing.status);
      return NextResponse.json({ ok: true, dedup: true, existing: claim.existing });
    }

    // 3) Ack fast + run the pipeline in the background so Composio doesn't
    //    cancel-and-retry while we call OpenAI / GitHub / Supabase.
    const eventId = claim.id;
    const { ctx } = await getCloudflareContext({ async: true });
    ctx.waitUntil(processInBackground(eventId, event));
    return NextResponse.json({ ok: true, queued: true, event_id: eventId });
  }

  // Fallback: no webhook id or unknown provider — process inline so we
  // never silently drop a real delivery.
  return processInline(event);
}

async function processInBackground(eventId: string, event: unknown) {
  try {
    const result = await processComposioWebhookPayload(event as Parameters<typeof processComposioWebhookPayload>[0]);
    console.log("[composio webhook] result", eventId, JSON.stringify(result));
    await finishWebhookEvent({
      id: eventId,
      status: result.ignored ? "ignored" : "done",
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[composio webhook] background failed", eventId, err);
    await finishWebhookEvent({ id: eventId, status: "error", lastError: message });
  }
}

async function processInline(event: unknown) {
  try {
    const result = await processComposioWebhookPayload(event as Parameters<typeof processComposioWebhookPayload>[0]);
    console.log("[composio webhook] inline result", JSON.stringify(result));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[composio webhook] inline processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

function readPayload(value: unknown) {
  if (value && typeof value === "object" && "payload" in value) {
    return (value as { payload: unknown }).payload;
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const v = record[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Composio's envelope carries `metadata.trigger_slug` (e.g.
 * `GITHUB_PULL_REQUEST_EVENT`). Map the toolkit prefix back to one of our
 * supported providers so the dedupe row points at the right integration.
 */
function inferProvider(event: unknown): IntegrationProvider | null {
  const metadata = asRecord(asRecord(event)?.metadata);
  const slug = readString(metadata, "trigger_slug")?.toLowerCase() ?? "";
  if (slug.startsWith("github")) return "github";
  if (slug.startsWith("linear")) return "linear";
  return null;
}

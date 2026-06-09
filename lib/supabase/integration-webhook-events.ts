import { createServiceClient } from "@/lib/supabase/server";
import type { IntegrationProvider } from "@/types/integration";

export type WebhookClaim =
  | { status: "claimed"; id: string }
  | { status: "already_processed"; existing: { status: string; result: unknown } };

/**
 * Best-effort idempotency claim for a Composio webhook delivery.
 *
 * Composio retries deliveries with the same `webhook-id` whenever it
 * doesn't see a 2xx in time. Without a claim row the heavy pipeline runs
 * once per retry, producing duplicate doc versions, redundant OpenAI
 * calls, and noisy activity entries.
 *
 * Behaviour:
 * - First time we see this `(provider, webhook_id)`: insert a row with
 *   status `pending` and return `{ status: 'claimed', id }`. The caller
 *   owns processing and must call `finishWebhookEvent`.
 * - On a retry where the row already exists: return
 *   `{ status: 'already_processed', existing }`. The caller should ack
 *   the webhook immediately without doing any work.
 */
export async function claimWebhookEvent(input: {
  webhookId: string;
  provider: IntegrationProvider;
  triggerSlug?: string | null;
}): Promise<WebhookClaim> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("integration_webhook_events")
    .insert({
      webhook_id: input.webhookId,
      provider: input.provider,
      trigger_slug: input.triggerSlug ?? null,
    })
    .select("id")
    .single();

  if (!error && data) return { status: "claimed", id: data.id as string };

  // Unique-violation (Postgres 23505): another delivery already claimed this
  // webhook id. Fetch the existing row so the caller can mirror its outcome.
  if (error?.code === "23505") {
    const { data: existing } = await supabase
      .from("integration_webhook_events")
      .select("status, result")
      .eq("provider", input.provider)
      .eq("webhook_id", input.webhookId)
      .maybeSingle();
    return {
      status: "already_processed",
      existing: {
        status: (existing?.status as string) ?? "pending",
        result: existing?.result ?? null,
      },
    };
  }

  // Any other error (network, schema, etc.). Surface it — the caller should
  // log and decide whether to drop the delivery or fall back to processing.
  throw error ?? new Error("Failed to claim webhook event");
}

export async function finishWebhookEvent(input: {
  id: string;
  status: "done" | "error" | "ignored";
  result?: unknown;
  lastError?: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("integration_webhook_events")
    .update({
      status: input.status,
      result: input.result ?? null,
      last_error: input.lastError ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) console.error("[integration_webhook_events] finish failed:", error.message);
}

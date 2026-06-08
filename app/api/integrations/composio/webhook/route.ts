import { NextRequest, NextResponse } from "next/server";
import { processComposioWebhookPayload } from "@/lib/integrations/source/feature-doc";
import { verifyComposioWebhook } from "@/lib/integrations/source/composio";

export async function POST(req: NextRequest) {
  const payload = await req.text();
  try {
    const verified = await verifyComposioWebhook({
      id: req.headers.get("webhook-id") ?? "",
      timestamp: req.headers.get("webhook-timestamp") ?? "",
      signature: req.headers.get("webhook-signature") ?? "",
      payload,
    });
    const parsed = readPayload(verified);
    const result = await processComposioWebhookPayload(parsed);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook";
    const status = message.includes("SECRET") ? 500 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}

function readPayload(value: unknown) {
  if (value && typeof value === "object" && "payload" in value) {
    return (value as { payload: unknown }).payload as Parameters<typeof processComposioWebhookPayload>[0];
  }
  return value as Parameters<typeof processComposioWebhookPayload>[0];
}

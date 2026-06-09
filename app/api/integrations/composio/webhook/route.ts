import { NextRequest, NextResponse } from "next/server";
import { processComposioWebhookPayload } from "@/lib/integrations/source/feature-doc";
import { verifyComposioWebhook } from "@/lib/integrations/source/composio";

export async function POST(req: NextRequest) {
  const payload = await req.text();
  console.log("[composio webhook] received", payload.slice(0, 1200));

  // 1) Verify signature — a failure here is genuinely a 401 (don't retry).
  let verified: unknown;
  try {
    verified = await verifyComposioWebhook({
      id: req.headers.get("webhook-id") ?? "",
      timestamp: req.headers.get("webhook-timestamp") ?? "",
      signature: req.headers.get("webhook-signature") ?? "",
      payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook";
    if (message.includes("SECRET")) return NextResponse.json({ error: message }, { status: 500 });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2) Process — a failure here is a 500 so Composio retries the delivery.
  try {
    const result = await processComposioWebhookPayload(readPayload(verified));
    console.log("[composio webhook] result", JSON.stringify(result));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[composio webhook] processing failed", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

function readPayload(value: unknown) {
  if (value && typeof value === "object" && "payload" in value) {
    return (value as { payload: unknown }).payload as Parameters<typeof processComposioWebhookPayload>[0];
  }
  return value as Parameters<typeof processComposioWebhookPayload>[0];
}

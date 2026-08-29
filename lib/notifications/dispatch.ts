/**
 * Sending a workspace's outbound notifications.
 *
 * Split from `webhook.ts` so the payload shape and the "who wants this event"
 * rule can be asserted without a database, and so this file — which touches
 * one — stays as small as it is.
 */
import { scoped } from "@/lib/db";
import { deliver, type WebhookEvent, type WebhookTarget } from "./webhook";

/**
 * Announce an event to every webhook configured for the workspace.
 *
 * Fire-and-forget by construction: it swallows its own failures, because the
 * thing it announces — a comment, a review request — has already happened and
 * must not be undone by a chat tool being unreachable. The bell remains the
 * source of truth.
 */
export type NotifyInput = {
  type: WebhookEvent["type"];
  text: string;
  docId: string;
  docTitle: string;
  actorName: string | null;
};

export async function notifyWebhooks(workspaceId: string, input: NotifyInput): Promise<void> {
  try {
    const db = scoped(workspaceId);
    const { data, error } = await db
      .from("workspace_webhooks")
      .select("id, url, events");
    if (error || !data || data.length === 0) return;

    // Resolved here rather than at each call site: every caller would
    // otherwise build the same URL, and one of them would build it wrong.
    const { data: workspace } = await db.from("workspaces").select("name, slug").single();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const event: WebhookEvent = {
      type: input.type,
      text: input.text,
      workspaceName: (workspace?.name as string | undefined) ?? "",
      docTitle: input.docTitle,
      docUrl:
        appUrl && workspace?.slug ? `${appUrl}/w/${workspace.slug}/docs/${input.docId}` : null,
      actorName: input.actorName,
    };

    const targets = data as WebhookTarget[];
    const results = await deliver(targets, event);

    // Record the outcome so a misconfigured URL is visible in Settings rather
    // than being something an admin has to guess at from silence in chat.
    await Promise.all(
      results.map((result) =>
        db
          .from("workspace_webhooks")
          .update({
            last_status: result.status,
            last_error: result.error,
            last_delivered_at: new Date().toISOString(),
          })
          .eq("id", result.id),
      ),
    );
  } catch (err) {
    console.error("notifyWebhooks failed:", err);
  }
}

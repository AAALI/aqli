/**
 * Outbound notifications (docs/adoption.md F-5).
 *
 * The in-app bell is the whole delivery mechanism for mentions and review
 * requests, and a team that lives in chat will miss both. This is the small,
 * chat-agnostic fix: one HTTPS POST per event, in a shape Slack, Teams and
 * Discord all accept without an OAuth flow between us and any of them.
 *
 * Two rules it follows, both because the payload leaves the building:
 *
 *   * it carries a title and a link, never document content — a webhook lands
 *     in a channel whose membership nobody here controls, and a private space's
 *     body has no business in it;
 *   * a delivery that fails is recorded and dropped, never retried into a
 *     queue this app does not have. The event it was announcing is still in the
 *     bell, which is the source of truth.
 */
export type WebhookEvent = {
  /** `mention` or `review_requested` — what the workspace subscribes to. */
  type: "mention" | "review_requested";
  /** One line, already written for a human: the thing chat will show. */
  text: string;
  workspaceName: string;
  docTitle: string;
  /** Absolute, so a link in chat works. Null when the app URL is not configured. */
  docUrl: string | null;
  actorName: string | null;
};

export type WebhookTarget = {
  id: string;
  url: string;
  /** Empty means every event. */
  events: string[];
};

/**
 * The body every target receives.
 *
 * `text` is what Slack and Teams render; `content` is the same string for
 * Discord, which reads a different key. Sending both costs nothing and saves
 * every customer from finding out the hard way that we picked the other one.
 * The structured fields underneath are for anything reading it as an API.
 */
export function webhookPayload(event: WebhookEvent): Record<string, unknown> {
  const line = event.docUrl ? `${event.text}: ${event.docTitle} — ${event.docUrl}` : `${event.text}: ${event.docTitle}`;
  return {
    text: line,
    content: line,
    event: event.type,
    workspace: event.workspaceName,
    doc: { title: event.docTitle, url: event.docUrl },
    actor: event.actorName,
  };
}

/** Does this target want this event? */
export function wants(target: WebhookTarget, type: WebhookEvent["type"]): boolean {
  return target.events.length === 0 || target.events.includes(type);
}

export type DeliveryResult = {
  id: string;
  status: number | null;
  error: string | null;
};

/**
 * Deliver to every target that wants the event.
 *
 * Never throws: a chat tool being down must not fail the comment that was being
 * posted. Callers record the results so an admin can see a misconfigured URL
 * rather than wondering why chat is quiet.
 */
export async function deliver(
  targets: WebhookTarget[],
  event: WebhookEvent,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryResult[]> {
  const body = JSON.stringify(webhookPayload(event));

  return Promise.all(
    targets
      .filter((target) => wants(target, event.type))
      .map(async (target): Promise<DeliveryResult> => {
        try {
          const res = await fetchImpl(target.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });
          return {
            id: target.id,
            status: res.status,
            error: res.ok ? null : `The endpoint answered ${res.status}`,
          };
        } catch (err) {
          return {
            id: target.id,
            status: null,
            error: err instanceof Error ? err.message : "Could not reach the endpoint",
          };
        }
      }),
  );
}

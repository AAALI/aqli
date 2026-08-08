/**
 * Analytics calls from Client Components.
 *
 * Importing `posthog-js` directly from a Client Component puts it in the
 * **server** bundle too: a Client Component is still server-rendered, so its
 * module graph is part of the worker. That is 73 KiB gzipped of browser
 * analytics SDK shipped to Cloudflare, inside a 3 MiB budget that Next's own
 * runtime already spends two thirds of.
 *
 * So the import happens at call time, in the browser, and never on the server.
 * `instrumentation-client.ts` still does the eager `init` — it is a
 * client-only entrypoint by Next convention and never enters the worker graph.
 *
 * Every function here is fire-and-forget. Analytics must not be able to fail
 * a user action, and a rejected import is not worth a console line on every
 * click for people running an ad blocker.
 */

type Props = Record<string, unknown>;

async function client() {
  if (typeof window === "undefined") return null;
  try {
    return (await import("posthog-js")).default;
  } catch {
    return null;
  }
}

export function capture(event: string, properties?: Props): void {
  void client().then((posthog) => posthog?.capture(event, properties));
}

export function identify(distinctId: string, properties?: Props): void {
  void client().then((posthog) => posthog?.identify(distinctId, properties));
}

export function captureException(error: unknown): void {
  void client().then((posthog) => posthog?.captureException(error));
}

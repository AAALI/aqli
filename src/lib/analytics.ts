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

/**
 * Run `fn` against the browser SDK, swallowing everything.
 *
 * The terminal `catch` is the point. `client()` handles a failed import, but
 * the SDK call itself can also reject — and a rejection with nothing after it
 * is an unhandled promise rejection, which surfaces in the console and, with
 * `capture_exceptions` on in `instrumentation-client.ts`, gets reported as an
 * error by the very SDK that produced it. Analytics must not be able to make
 * noise about analytics.
 */
function fire(fn: (posthog: NonNullable<Awaited<ReturnType<typeof client>>>) => void): void {
  void client()
    .then((posthog) => {
      if (posthog) fn(posthog);
    })
    .catch(() => undefined);
}

export function capture(event: string, properties?: Props): void {
  fire((posthog) => posthog.capture(event, properties));
}

export function identify(distinctId: string, properties?: Props): void {
  fire((posthog) => posthog.identify(distinctId, properties));
}

export function captureException(error: unknown): void {
  fire((posthog) => posthog.captureException(error));
}

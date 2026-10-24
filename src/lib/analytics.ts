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
 * `lib/posthog-browser.ts` owns the load and the `init`; `instrumentation-
 * client.ts` kicks it off once the page is idle, and a `capture` that arrives
 * before then simply waits for it.
 *
 * Every function here is fire-and-forget. Analytics must not be able to fail
 * a user action, and a rejected import is not worth a console line on every
 * click for people running an ad blocker.
 */

import { loadPosthog } from "@/lib/posthog-browser";

type Props = Record<string, unknown>;

/**
 * The SDK, loaded and initialised on first use (`lib/posthog-browser.ts`), or
 * `null` on the server and wherever the import was blocked.
 */
function client() {
  return loadPosthog();
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

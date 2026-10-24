import { loadPosthog } from "@/lib/posthog-browser";

/**
 * Starts analytics once the page is idle, not before it is interactive.
 *
 * This file is Next's client entrypoint and runs before hydration, so a
 * static `import posthog from "posthog-js"` here put the whole SDK in the
 * root bundle of every route (see `lib/posthog-browser.ts`). The dynamic
 * import keeps it in its own chunks, and waiting for `load` plus an idle
 * callback keeps those chunks from competing with the app's own JavaScript
 * for a phone's radio and CPU.
 *
 * Errors thrown before the SDK is up would otherwise be lost. They are held
 * (a handful at most) and reported once it has loaded.
 */
const EARLY_ERROR_CAP = 10;
const earlyErrors: unknown[] = [];

function remember(error: unknown) {
  if (earlyErrors.length < EARLY_ERROR_CAP) earlyErrors.push(error);
}
const onError = (event: ErrorEvent) => remember(event.error ?? event.message);
const onRejection = (event: PromiseRejectionEvent) => remember(event.reason);
window.addEventListener("error", onError);
window.addEventListener("unhandledrejection", onRejection);

function start() {
  void loadPosthog().then((posthog) => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    if (!posthog) return;
    for (const error of earlyErrors.splice(0)) {
      try {
        posthog.captureException(error);
      } catch {
        // Analytics must not make noise about analytics.
      }
    }
  });
}

const whenIdle = (fn: () => void) => {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(fn, { timeout: 4000 });
  else window.setTimeout(fn, 1500);
};

if (document.readyState === "complete") whenIdle(start);
else window.addEventListener("load", () => whenIdle(start), { once: true });

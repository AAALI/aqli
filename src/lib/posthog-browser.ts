/**
 * The one place the browser analytics SDK is loaded.
 *
 * `posthog-js` is ~130 KiB gzipped across two chunks. It used to be imported
 * at the top of `instrumentation-client.ts`, which Next puts in the root
 * bundle of every page — so a phone on a slow connection downloaded, parsed
 * and ran the analytics SDK before it could hydrate anything the person came
 * for. Loading it here, on demand and after the page is idle, takes it off
 * that path entirely; the first `capture` simply waits for it.
 *
 * Nothing here can throw at the caller: a blocked request (ad blocker, strict
 * network) resolves to `null`, and analytics then does nothing.
 */
import type { PostHog } from "posthog-js";

let loading: Promise<PostHog | null> | null = null;

export function loadPosthog(): Promise<PostHog | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (loading) return loading;

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!token) {
    loading = Promise.resolve(null);
    return loading;
  }

  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      if (!posthog.__loaded) {
        posthog.init(token, {
          api_host: "/ingest",
          ui_host: "https://eu.posthog.com",
          defaults: "2026-01-30",
          capture_exceptions: true,
          debug: process.env.NODE_ENV === "development",
        });
      }
      return posthog;
    })
    .catch(() => null);
  return loading;
}

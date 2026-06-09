import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

// Initialise the OpenNext Cloudflare dev bindings only when running the local
// Next.js dev server. We intentionally fire-and-forget with `void` and swallow
// errors so a missing/unavailable Cloudflare runtime never breaks `next dev`,
// and the call never runs at all in production builds.
if (process.env.NODE_ENV === "development") {
  void import("@opennextjs/cloudflare")
    .then((m) => m.initOpenNextCloudflareForDev())
    .catch((err) => {
      console.warn("[next.config] initOpenNextCloudflareForDev failed:", err);
    });
}

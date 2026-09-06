import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aqli.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Workspace content is private (auth-gated anyway), the API is not a
      // web page, and invite links carry secret tokens.
      disallow: ["/w/", "/api/", "/invite"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}

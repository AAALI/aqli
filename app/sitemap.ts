import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://aqli.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${APP_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${APP_URL}/signup`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${APP_URL}/login`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${APP_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${APP_URL}/terms`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}

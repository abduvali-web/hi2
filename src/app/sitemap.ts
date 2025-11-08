import type { MetadataRoute } from "next";

/**
 * Todo #6: Sitemap (no locale alternates due to non-prefixed routes).
 * Routes are absolute using NEXT_PUBLIC_SITE_URL; falls back to http://localhost:3000.
 * Future page-level additions (pricing/contact/success) can plug in here as routes expand.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const now = new Date();

  const routes = [
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.8 },
    { path: "/contact", changeFrequency: "weekly", priority: 0.8 },
    { path: "/order-success", changeFrequency: "weekly", priority: 0.6 },
    { path: "/admin/login", changeFrequency: "weekly", priority: 0.6 },
  ] as const;

  return routes.map((r) => ({
    url: new URL(r.path, baseUrl).toString(),
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.VIBEGUARD_API_URL ?? "http://127.0.0.1:3000";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/zh/admin/", "/en/admin/", "/api/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

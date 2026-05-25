import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.VIBEGUARD_API_URL ?? "http://127.0.0.1:3000";

  return [
    { url: `${baseUrl}/zh`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/en`, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/zh/articles`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/en/articles`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${baseUrl}/zh/api`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/en/api`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  ];
}

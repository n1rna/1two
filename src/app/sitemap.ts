import type { MetadataRoute } from "next";
import { tools, getSearchItems } from "@/lib/tools/registry";

const SITE_URL = "https://1two.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const toolPages = tools.map((tool) => ({
    url: `${SITE_URL}/tools/${tool.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const subPages = getSearchItems()
    .filter((item) => item.href.split("/").length > 3)
    .map((item) => ({
      url: `${SITE_URL}${item.href}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...toolPages,
    ...subPages,
  ];
}

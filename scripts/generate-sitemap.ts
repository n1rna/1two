import { tools, getSearchItems } from "../src/lib/tools/registry";
import { guides } from "../src/lib/guides/registry";
import { docs } from "../src/lib/docs/registry";
import { writeFileSync } from "fs";
import { join } from "path";

const SITE_URL = "https://1tt.dev";
const today = new Date().toISOString().split("T")[0];

const subPages = getSearchItems()
  .filter((item) => item.href.startsWith("/tools/") && item.href.split("/").length > 3)
  .map((item) => ({
    loc: `${SITE_URL}${item.href}`,
    changefreq: "weekly",
    priority: "0.7",
  }));

const urls = [
  { loc: SITE_URL, changefreq: "weekly", priority: "1.0" },
  ...tools.map((t) => ({
    loc: `${SITE_URL}/tools/${t.slug}`,
    changefreq: "weekly",
    priority: "0.8",
  })),
  ...subPages,
  ...guides.map((g) => ({
    loc: `${SITE_URL}/guides/${g.slug}`,
    changefreq: "monthly",
    priority: "0.7",
  })),
  ...docs.map((d) => ({
    loc: `${SITE_URL}/docs/${d.slug}`,
    changefreq: "monthly",
    priority: "0.7",
  })),
  ...["/guides", "/terms", "/privacy", "/support"].map((path) => ({
    loc: `${SITE_URL}${path}`,
    changefreq: "monthly",
    priority: "0.5",
  })),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

writeFileSync(join(import.meta.dirname, "../public/sitemap.xml"), xml);
console.log(`Sitemap generated with ${urls.length} URLs`);

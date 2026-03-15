import { ElasticsearchExplorer } from "@/components/tools/elasticsearch-explorer";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "elasticsearch",
  title: "Elasticsearch Explorer — 1two.dev",
  description:
    "Connect to Elasticsearch clusters, browse indices, run queries, manage documents, and monitor cluster health — all from the browser.",
  keywords: [
    "elasticsearch",
    "es",
    "elastic",
    "cluster",
    "index",
    "query",
    "search",
    "kibana",
    "opensearch",
    "mapping",
    "shards",
    "elasticsearch explorer",
    "elasticsearch browser",
    "elasticsearch client",
  ],
});

export default function ElasticsearchPage() {
  const jsonLd = toolJsonLd("elasticsearch");
  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <ElasticsearchExplorer />
    </>
  );
}

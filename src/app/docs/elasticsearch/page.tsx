import { DocLayout } from "@/components/layout/doc-layout";
import type { Metadata } from "next";

const MARKDOWN = `
## Overview

The Elasticsearch Explorer lets you connect to any Elasticsearch cluster, browse indices, run queries, manage documents, and monitor cluster health — all from the browser without installing a desktop client.

It supports Elasticsearch 7.x and 8.x, as well as OpenSearch-compatible clusters.

## Connecting to a Cluster

Click **Connections** in the top bar and fill in your cluster details:

- **URL** — Your Elasticsearch endpoint, e.g. \`https://my-cluster.es.amazonaws.com\` or \`http://localhost:9200\`
- **Authentication** — Choose from Basic auth (username + password), API key, or Bearer token
- **Name** — A friendly label shown in the connection switcher

Connections are stored locally in your browser and optionally synced to the cloud if you enable Cloud Sync.

### Connecting to AWS OpenSearch

For AWS OpenSearch Service, use the domain endpoint from the AWS console. If your domain uses IAM authentication, generate temporary credentials or create an IAM user with \`es:ESHttp*\` permissions and use Basic auth with those credentials.

### Self-hosted clusters

For clusters running on \`localhost\`, the browser enforces CORS. Add the following to your \`elasticsearch.yml\`:

\`\`\`yaml
http.cors.enabled: true
http.cors.allow-origin: "https://1tt.dev"
http.cors.allow-headers: "Authorization,Content-Type"
\`\`\`

## Browsing Indices

Once connected, the sidebar lists all indices with their health status (green / yellow / red), document count, and storage size. Click any index to open it.

The index view shows:

- **Mappings** — field names, types, and analyzer settings
- **Settings** — shard count, replica count, refresh interval
- **Aliases** — any aliases pointing to this index
- **Documents** — a paginated table of documents with inline editing

## Running Queries

The **Search** tab provides a JSON query editor with:

- **Syntax highlighting** powered by CodeMirror
- **Auto-completion** for Elasticsearch Query DSL keywords and your index's field names
- **AI-powered query generation** — describe what you need in plain English and the AI generates the DSL for you

### Query Editor

Write standard Elasticsearch Query DSL as JSON. The editor validates your JSON in real time and highlights errors before you run the query.

\`\`\`json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "title": "typescript" } }
      ],
      "filter": [
        { "range": { "published_at": { "gte": "now-30d" } } }
      ]
    }
  },
  "size": 20
}
\`\`\`

Press **Ctrl+Enter** (or **Cmd+Enter** on macOS) to run the query.

### AI Assistant

Describe what you want in the prompt field above the editor and click **Generate**. The AI reads your index mappings so it can reference real field names.

Example prompts:

- *"Find all orders from the last 7 days with status pending"*
- *"Aggregate sales by country for Q1 2024"*
- *"Full-text search for 'machine learning' in the body field"*

## Managing Documents

### Viewing Documents

The document table shows all fields in a responsive grid. Long values are truncated with a **Expand** link. Click any row to open a side panel with the full document JSON.

### Creating Documents

Click **New document** and paste or type JSON. The editor validates the structure against your index mappings and warns about type mismatches before indexing.

### Editing Documents

Open a document and click **Edit**. Changes are applied with a partial update (\`_update\` API), so unmodified fields are preserved.

### Deleting Documents

Select one or more documents with the checkboxes and click **Delete selected**, or open a single document and click **Delete**.

## Cluster Health

The **Overview** tab shows a live snapshot of your cluster:

| Metric | Description |
|--------|-------------|
| Status | Overall health: green, yellow, or red |
| Nodes | Total node count and roles |
| Indices | Number of open indices |
| Documents | Total document count across all indices |
| Disk usage | Used vs. allocated disk space |

The node list shows per-node CPU, heap, and disk stats, refreshed every 30 seconds.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Run query |
| Ctrl+/ | Toggle line comment |
| Ctrl+Shift+F | Format / prettify JSON |
| Esc | Close side panel |
`;

export const metadata: Metadata = {
  title: "Elasticsearch Explorer Documentation — 1tt.dev",
  description:
    "Learn how to connect to Elasticsearch clusters, browse indices, run queries, and monitor cluster health using the Elasticsearch Explorer on 1tt.dev.",
};

export default function ElasticsearchDocsPage() {
  return (
    <DocLayout
      title="Elasticsearch Explorer"
      description="Connect to any Elasticsearch cluster, browse indices, run queries, and monitor cluster health — all from your browser."
      toolSlug="elasticsearch"
      markdown={MARKDOWN}
    />
  );
}

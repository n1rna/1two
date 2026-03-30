import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { LlmsTxtGenerator } from "@/components/tools/llms-txt-generator";
import { LlmsToolbar } from "@/components/tools/llms-history-popover";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "llms-txt",
  title: "llms.txt Generator",
  description:
    "Generate llms.txt files from any website or documentation. Crawls the site, analyzes content with AI, and outputs a structured file optimized for LLM consumption.",
  keywords: [
    "llms.txt",
    "llms",
    "ai context",
    "documentation",
    "crawl",
    "generate",
    "sitemap",
    "llm",
    "claude",
    "openai",
    "context file",
  ],
});

export default function LlmsTxtPage() {
  const jsonLd = toolJsonLd("llms-txt");
  return (
    <ToolLayout slug="llms-txt" toolbar={<LlmsToolbar />}>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <LlmsTxtGenerator />

      <ToolInfo>
        <ToolInfo.H2>What is llms.txt?</ToolInfo.H2>
        <ToolInfo.P>
          <ToolInfo.Code>llms.txt</ToolInfo.Code> is a proposed standard format for providing website content optimized for LLM consumption. Created to help AI assistants understand documentation, APIs, and open source projects, the file contains structured links and descriptions organized by topic - similar to <ToolInfo.Code>robots.txt</ToolInfo.Code> but for language models.
        </ToolInfo.P>
        <ToolInfo.P>
          The format was proposed to give AI tools a curated, high-signal entry point into a site rather than forcing them to crawl and interpret arbitrary HTML.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          This tool crawls the provided URL using Cloudflare Browser Rendering, discovers linked pages via sitemaps and internal links, then uses Claude AI to analyze the content and produce a well-structured <ToolInfo.Code>llms.txt</ToolInfo.Code> file. Pages are grouped by topic with concise descriptions suitable for LLM context windows.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li><ToolInfo.Strong>Provide a URL</ToolInfo.Strong> - documentation sites, GitHub repos, API references, or any public website</li>
          <li><ToolInfo.Strong>Configure scan depth</ToolInfo.Strong> - shallow for quick overviews, deep for comprehensive coverage</li>
          <li><ToolInfo.Strong>Choose a detail level</ToolInfo.Strong> - overview for high-level structure, detailed for extended descriptions</li>
          <li><ToolInfo.Strong>Download or copy the link</ToolInfo.Strong> - get a hosted URL you can reference directly in prompts</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Creating AI context files for open source projects so contributors and users can query docs with LLMs</li>
          <li>Generating documentation summaries for LLM-powered tools, chatbots, and RAG pipelines</li>
          <li>Building <ToolInfo.Code>llms.txt</ToolInfo.Code> for API documentation to help AI coding assistants understand your SDK</li>
          <li>Producing structured overviews of large sites for use in system prompts</li>
        </ToolInfo.UL>


      </ToolInfo>
    </ToolLayout>
  );
}

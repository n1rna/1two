import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "llms-txt-generator";

export const metadata = guideMetadata({
  slug,
  title: "Generate llms.txt for Any Website",
  description:
    "Crawl any site and generate an llms.txt file that gives LLMs the context they need - ideal for RAG pipelines, AI assistants, and documentation.",
  keywords: [
    "llms.txt",
    "llms",
    "ai context",
    "rag",
    "documentation",
    "crawl",
    "sitemap",
    "ai documentation",
    "context window",
  ],
});

export default function LlmsTxtGuide() {
  const jsonLd = guideJsonLd(slug);
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <GuideLayout slug={slug}>
        <Guide.H2>What is llms.txt?</Guide.H2>
        <Guide.P>
          <Guide.Code>llms.txt</Guide.Code> is a proposed standard - similar to{" "}
          <Guide.Code>robots.txt</Guide.Code> - that provides a structured,
          high-signal summary of a website&apos;s content specifically for large language
          models. Instead of forcing an LLM to parse raw HTML or crawl hundreds of pages,{" "}
          <Guide.Code>llms.txt</Guide.Code> gives it a single document with the
          information it actually needs.
        </Guide.P>
        <Guide.P>
          The file typically includes a site overview, key pages and their purpose,
          API references, getting-started instructions, and other content that helps an
          LLM answer questions about the site accurately.
        </Guide.P>

        <Guide.H2>Why it matters</Guide.H2>
        <Guide.P>
          LLMs have limited context windows. Feeding them entire websites is wasteful and
          often impossible. A well-crafted <Guide.Code>llms.txt</Guide.Code> solves this
          by distilling a site into exactly the kind of structured content that LLMs work
          best with:
        </Guide.P>
        <Guide.UL>
          <li>
            <Guide.Strong>Reduced noise</Guide.Strong> - no navigation, footers, ads, or
            boilerplate. Just the substance.
          </li>
          <li>
            <Guide.Strong>Better answers</Guide.Strong> - LLMs get clear context about
            what the site does, how its APIs work, and where to find specific information.
          </li>
          <li>
            <Guide.Strong>Token efficiency</Guide.Strong> - a single file replaces
            hundreds of pages worth of crawled content.
          </li>
          <li>
            <Guide.Strong>Consistency</Guide.Strong> - every query against the site gets
            the same high-quality context, regardless of which pages the LLM might have
            otherwise discovered.
          </li>
        </Guide.UL>

        <Guide.H2>How the generator works</Guide.H2>
        <Guide.P>
          The 1tt.dev <Guide.Strong>llms.txt Generator</Guide.Strong> automates the
          entire process. You provide a URL, and it handles crawling, content extraction,
          and AI-powered summarization.
        </Guide.P>
        <Guide.Step n={1}>
          <Guide.P>
            <Guide.Strong>Paste a URL</Guide.Strong> - the tool checks if the site has
            been crawled recently. If a cached version exists, you can use it or start
            fresh.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={2}>
          <Guide.P>
            <Guide.Strong>Choose scan depth</Guide.Strong> - select how deep the crawler
            should go. <Guide.Code>Auto</Guide.Code> lets the tool decide based on the
            site structure. You can also set 1, 3, or 5 levels for more control.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={3}>
          <Guide.P>
            <Guide.Strong>Pick a detail level</Guide.Strong> -{" "}
            <Guide.Code>overview</Guide.Code> produces a compact summary,{" "}
            <Guide.Code>standard</Guide.Code> covers the main content, and{" "}
            <Guide.Code>detailed</Guide.Code> includes deeper technical information.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={4}>
          <Guide.P>
            <Guide.Strong>Download or publish</Guide.Strong> - once generated, you can
            download the file, copy the content, or publish it to a permanent URL that
            you can reference from your site.
          </Guide.P>
        </Guide.Step>

        <Guide.H3>Under the hood</Guide.H3>
        <Guide.P>
          The crawler uses Cloudflare browser rendering to handle JavaScript-heavy sites.
          It discovers pages through sitemaps, internal links, and common documentation
          patterns. The extracted content is then processed by Claude to produce a
          structured, LLM-friendly summary.
        </Guide.P>

        <Guide.H2>Use cases</Guide.H2>

        <Guide.H3>RAG pipelines</Guide.H3>
        <Guide.P>
          If you&apos;re building a retrieval-augmented generation system,{" "}
          <Guide.Code>llms.txt</Guide.Code> gives you a clean, pre-processed document
          to index. Instead of chunking raw HTML and dealing with extraction noise, you
          get structured content that&apos;s already optimized for LLM consumption.
        </Guide.P>

        <Guide.H3>AI assistants and chatbots</Guide.H3>
        <Guide.P>
          Building a support bot or documentation assistant? Include the site&apos;s{" "}
          <Guide.Code>llms.txt</Guide.Code> in the system prompt or context window.
          The LLM gets a complete picture of the product without needing to crawl
          anything at runtime.
        </Guide.P>

        <Guide.H3>Open-source project context</Guide.H3>
        <Guide.P>
          Generate an <Guide.Code>llms.txt</Guide.Code> for your project&apos;s
          documentation site and commit it to the repo. AI coding tools like Claude Code,
          Cursor, or GitHub Copilot can use it to understand your project&apos;s APIs,
          conventions, and architecture.
        </Guide.P>

        <Guide.H3>SDK and API documentation</Guide.H3>
        <Guide.P>
          API docs are often spread across dozens of pages with complex navigation.
          An <Guide.Code>llms.txt</Guide.Code> file condenses endpoints, parameters,
          authentication flows, and error codes into a single reference that fits in a
          context window.
        </Guide.P>

        <Guide.H3>Internal knowledge bases</Guide.H3>
        <Guide.P>
          Point the generator at your company&apos;s internal docs or wiki. The resulting
          file can be used as context for internal AI tools, onboarding assistants, or
          automated Q&A systems.
        </Guide.P>

        <Guide.H2>Publishing your llms.txt</Guide.H2>
        <Guide.P>
          After generating a file, you can publish it to get a permanent URL like{" "}
          <Guide.Code>https://1tt.dev/llms/your-site/llms.txt</Guide.Code>. Add this
          to your site&apos;s root or reference it in your{" "}
          <Guide.Code>robots.txt</Guide.Code>:
        </Guide.P>
        <Guide.Callout>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre">
{`# robots.txt
User-agent: *
Allow: /

# LLM context
Llms-txt: https://1tt.dev/llms/your-site/llms.txt`}
          </pre>
        </Guide.Callout>
        <Guide.P>
          Published files can be updated by re-running the generator. The URL stays the
          same, so anything referencing it gets the latest version automatically.
        </Guide.P>
      </GuideLayout>
    </>
  );
}

import { ToolInfo } from "@/components/layout/tool-info";
import { OgChecker } from "@/components/tools/og-checker";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "og-checker",
  title: "OG Image Checker",
  description:
    "Check Open Graph images and meta tags for any URL - preview og:image, twitter:card, title, description, and more.",
  keywords: [
    "og image checker",
    "open graph",
    "meta tags",
    "og:image",
    "twitter card",
    "social media preview",
    "seo",
    "social preview",
    "facebook meta",
    "link preview",
  ],
});

export default function OgCheckerPage() {
  const jsonLd = toolJsonLd("og-checker");
  return (
    <OgChecker>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      <ToolInfo>
        <ToolInfo.H2>What is Open Graph?</ToolInfo.H2>
        <ToolInfo.P>
          Open Graph (OG) is a protocol introduced by Facebook that allows web pages to control how they appear when shared on social media platforms. By adding <ToolInfo.Code>og:</ToolInfo.Code> meta tags to a page, developers specify the title, description, and image used in link previews on Facebook, LinkedIn, Slack, Discord, iMessage, and many other platforms.
        </ToolInfo.P>
        <ToolInfo.P>
          Twitter (now X) has its own similar system called Twitter Cards, using <ToolInfo.Code>twitter:</ToolInfo.Code> meta tags. Most platforms fall back to OG tags when Twitter-specific tags are absent.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          When a URL is shared, the receiving platform fetches the page HTML and reads the <ToolInfo.Code>{"<meta>"}</ToolInfo.Code> tags in the <ToolInfo.Code>{"<head>"}</ToolInfo.Code>. Key tags include <ToolInfo.Code>og:title</ToolInfo.Code>, <ToolInfo.Code>og:description</ToolInfo.Code>, <ToolInfo.Code>og:image</ToolInfo.Code>, and <ToolInfo.Code>og:url</ToolInfo.Code>. This tool fetches the page server-side and extracts all relevant meta tags, then renders the detected images directly so you can verify the preview before sharing.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Enter a <ToolInfo.Strong>full URL</ToolInfo.Strong> (including <ToolInfo.Code>https://</ToolInfo.Code>) and click <ToolInfo.Strong>Check</ToolInfo.Strong></li>
          <li>View the detected <ToolInfo.Strong>OG images</ToolInfo.Strong> rendered at full size, with dimensions and type info</li>
          <li>Inspect <ToolInfo.Strong>page info</ToolInfo.Strong> - title, description, favicon, and theme color</li>
          <li>Check <ToolInfo.Strong>Twitter Card</ToolInfo.Strong> tags separately if the page uses them</li>
          <li>Copy any image URL with the <ToolInfo.Strong>copy button</ToolInfo.Strong> next to it</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Verifying that <ToolInfo.Code>og:image</ToolInfo.Code> is set correctly before sharing a blog post or product page</li>
          <li>Debugging why a link preview looks wrong on Slack, Discord, or LinkedIn</li>
          <li>Confirming image dimensions match the recommended <ToolInfo.Code>1200 x 630</ToolInfo.Code> ratio for Facebook and LinkedIn</li>
          <li>Checking <ToolInfo.Code>twitter:card</ToolInfo.Code> type (<ToolInfo.Code>summary</ToolInfo.Code> vs <ToolInfo.Code>summary_large_image</ToolInfo.Code>) and associated metadata</li>
          <li>Auditing multiple pages on a site for missing or incorrect OG tags</li>
        </ToolInfo.UL>


      </ToolInfo>
    </OgChecker>
  );
}

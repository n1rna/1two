import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { PasteTool } from "@/components/tools/paste-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "paste",
  title: "Paste Bin",
  description:
    "Create and share text snippets with short, shareable links.",
  keywords: [
    "pastebin",
    "paste",
    "snippet",
    "share text",
    "share code",
    "gist",
    "text sharing",
  ],
});

export default function PastePage() {
  const jsonLd = toolJsonLd("paste");
  return (
    <ToolLayout slug="paste">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <PasteTool />

      <ToolInfo>
        <ToolInfo.H2>What is a paste bin?</ToolInfo.H2>
        <ToolInfo.P>
          A paste bin is a web service for sharing text snippets via short, shareable URLs. Unlike traditional pastebins, this tool is tied to your account so you can manage and delete your pastes.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li><ToolInfo.Strong>Sign in</ToolInfo.Strong> to create and manage pastes</li>
          <li>Paste or type your text, code, or log output</li>
          <li>Get a <ToolInfo.Strong>short shareable link</ToolInfo.Strong> to send to others</li>
          <li>Manage and delete your pastes from your account</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Sharing code snippets, error logs, or config files with teammates</li>
          <li>Sending text that&apos;s too long for chat messages</li>
          <li>Quick alternative to creating a GitHub Gist</li>
        </ToolInfo.UL>


      </ToolInfo>
    </ToolLayout>
  );
}

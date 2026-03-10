import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { Base64Codec } from "@/components/tools/base64-codec";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "b64",
  title: "Base64 Encoder & Decoder",
  description:
    "Encode and decode Base64 strings online. Supports standard and URL-safe Base64 encoding. Convert text, data URIs, and binary data to and from Base64.",
  keywords: [
    "base64 encoder",
    "base64 decoder",
    "base64 encode online",
    "base64 decode online",
    "url safe base64",
    "data uri",
    "base64 converter",
    "text to base64",
    "base64 to text",
  ],
});

export default function Base64CodecPage() {
  const jsonLd = toolJsonLd("b64");
  return (
    <ToolLayout slug="b64">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <Base64Codec />

      <ToolInfo>
        <ToolInfo.H2>What is Base64?</ToolInfo.H2>
        <ToolInfo.P>
          Base64 is a binary-to-text encoding scheme that represents binary data using a set of 64 ASCII characters — <ToolInfo.Code>A–Z</ToolInfo.Code>, <ToolInfo.Code>a–z</ToolInfo.Code>, <ToolInfo.Code>0–9</ToolInfo.Code>, <ToolInfo.Code>+</ToolInfo.Code>, and <ToolInfo.Code>/</ToolInfo.Code>. It is commonly used to embed binary data in text-based formats like JSON, HTML, emails, and URLs.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          The encoding process takes every 3 bytes (24 bits) of input and splits them into four 6-bit groups. Each group maps to one of the 64 characters. If the input length isn&apos;t a multiple of 3, the output is padded with <ToolInfo.Code>=</ToolInfo.Code> characters.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Type or paste <ToolInfo.Strong>plain text</ToolInfo.Strong> on the left — it is automatically encoded to Base64 on the right</li>
          <li>Type or paste a <ToolInfo.Strong>Base64 string</ToolInfo.Strong> on the right — it is automatically decoded to plain text on the left</li>
          <li>Toggle <ToolInfo.Strong>URL-safe</ToolInfo.Strong> mode to use <ToolInfo.Code>-</ToolInfo.Code> and <ToolInfo.Code>_</ToolInfo.Code> instead of <ToolInfo.Code>+</ToolInfo.Code> and <ToolInfo.Code>/</ToolInfo.Code>, which is safer for URLs and filenames</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Embedding images in CSS or HTML as <ToolInfo.Code>data:</ToolInfo.Code> URIs</li>
          <li>Encoding credentials for <ToolInfo.Code>Authorization: Basic</ToolInfo.Code> HTTP headers</li>
          <li>Transferring binary data through JSON APIs or email (MIME)</li>
          <li>Storing binary blobs in text-only environments like environment variables or config files</li>
        </ToolInfo.UL>
      </ToolInfo>
    </ToolLayout>
  );
}

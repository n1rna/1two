import { HashTool } from "@/components/tools/hash-tool";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "hash",
  title: "Hash Generator - MD5, SHA-1, SHA-256, SHA-384, SHA-512",
  description:
    "Generate cryptographic hashes for text or files using MD5, SHA-1, SHA-256, SHA-384, and SHA-512. Compute all algorithms at once, copy results, and verify file integrity.",
  keywords: [
    "hash generator",
    "md5",
    "sha256",
    "sha512",
    "sha1",
    "sha384",
    "checksum",
    "file hash",
    "crypto hash",
    "digest",
    "integrity",
  ],
});

export default function HashPage() {
  const jsonLd = toolJsonLd("hash");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <HashTool />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is a cryptographic hash?</ToolInfo.H2>
          <ToolInfo.P>
            A cryptographic hash function takes an input of any size and produces a fixed-length digest. The same input always produces the same output, but even a single-character change produces a completely different hash. Hashes are one-way - you cannot reverse a hash to recover the original input.
          </ToolInfo.P>

          <ToolInfo.H2>Supported algorithms</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Code>MD5</ToolInfo.Code> - 128-bit digest, fast but considered insecure for cryptographic purposes</li>
            <li><ToolInfo.Code>SHA-1</ToolInfo.Code> - 160-bit digest, deprecated for security but still used for checksums</li>
            <li><ToolInfo.Code>SHA-256</ToolInfo.Code> - 256-bit digest, part of the SHA-2 family, widely used and recommended</li>
            <li><ToolInfo.Code>SHA-384</ToolInfo.Code> - 384-bit truncated variant of SHA-512</li>
            <li><ToolInfo.Code>SHA-512</ToolInfo.Code> - 512-bit digest, strongest option in the SHA-2 family</li>
          </ToolInfo.UL>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Type or paste <ToolInfo.Strong>text</ToolInfo.Strong> to compute all hash algorithms at once</li>
            <li>Drop or select a <ToolInfo.Strong>file</ToolInfo.Strong> to compute its hash digests</li>
            <li>Copy any hash value with one click</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Verifying file integrity after downloads using <ToolInfo.Code>SHA-256</ToolInfo.Code> checksums</li>
            <li>Computing content hashes for cache busting or deduplication</li>
            <li>Checking <ToolInfo.Code>Subresource Integrity</ToolInfo.Code> (SRI) hashes for CDN scripts</li>
            <li>Comparing hashes to detect file tampering</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}

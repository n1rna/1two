import { Suspense } from "react";
import { RandomGenerator } from "@/components/tools/random-generator";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "random",
  title: "Random Generator - UUID, Password & More",
  description:
    "Generate random UUIDs (v4 & v7), secure passwords, secret keys, hex strings, Base64 tokens, numbers, and lorem ipsum text. Cryptographically secure generation.",
  keywords: [
    "uuid generator",
    "random password generator",
    "uuid v4",
    "uuid v7",
    "secret key generator",
    "random hex string",
    "random number generator",
    "lorem ipsum generator",
    "secure password",
    "token generator",
  ],
});

export default function RandomPage() {
  const jsonLd = toolJsonLd("random");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <Suspense>
        <RandomGenerator />
      </Suspense>
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is this tool?</ToolInfo.H2>
          <ToolInfo.P>
            A collection of cryptographically secure random generators. All values are generated client-side using the Web Crypto API (<ToolInfo.Code>crypto.getRandomValues</ToolInfo.Code>), meaning nothing is sent to a server.
          </ToolInfo.P>

          <ToolInfo.H2>Available generators</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Strong>UUID</ToolInfo.Strong> — version 4 (random) and version 7 (time-ordered) UUIDs per <ToolInfo.Code>RFC 9562</ToolInfo.Code></li>
            <li><ToolInfo.Strong>Password</ToolInfo.Strong> — configurable length with uppercase, lowercase, digits, and symbols</li>
            <li><ToolInfo.Strong>Secret Key</ToolInfo.Strong> — hex-encoded cryptographic keys in common sizes (128, 256, 512 bit)</li>
            <li><ToolInfo.Strong>Hex String</ToolInfo.Strong> — random hexadecimal strings of any length</li>
            <li><ToolInfo.Strong>Base64</ToolInfo.Strong> — random Base64-encoded tokens</li>
            <li><ToolInfo.Strong>Number</ToolInfo.Strong> — random integers within a custom range</li>
            <li><ToolInfo.Strong>Lorem Ipsum</ToolInfo.Strong> — placeholder text by paragraphs, sentences, or words</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Generating <ToolInfo.Code>UUID</ToolInfo.Code> primary keys for database records</li>
            <li>Creating secure API keys, tokens, and <ToolInfo.Code>BETTER_AUTH_SECRET</ToolInfo.Code>-style secrets</li>
            <li>Generating strong passwords for new accounts or services</li>
            <li>Filling mockups and prototypes with placeholder text</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}

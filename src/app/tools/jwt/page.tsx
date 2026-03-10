import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { JwtParser } from "@/components/tools/jwt-parser";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "jwt",
  title: "JWT Parser & Decoder",
  description:
    "Decode and inspect JSON Web Tokens (JWT) online. View header, payload, claims, expiration, and verify signatures. Supports HS256, RS256, and ES256 algorithms.",
  keywords: [
    "jwt decoder",
    "jwt parser",
    "json web token",
    "jwt debugger",
    "decode jwt",
    "jwt claims",
    "jwt header",
    "jwt payload",
    "bearer token",
    "jwt online",
  ],
});

export default function JwtParserPage() {
  const jsonLd = toolJsonLd("jwt");
  return (
    <ToolLayout slug="jwt">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <JwtParser />

      <ToolInfo>
        <ToolInfo.H2>What is a JSON Web Token (JWT)?</ToolInfo.H2>
        <ToolInfo.P>
          A JSON Web Token is a compact, URL-safe token format defined in <ToolInfo.Code>RFC 7519</ToolInfo.Code>. It consists of three Base64URL-encoded parts separated by dots: <ToolInfo.Code>header.payload.signature</ToolInfo.Code>. JWTs are widely used for authentication, authorization, and secure information exchange between services.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          The <ToolInfo.Strong>header</ToolInfo.Strong> specifies the signing algorithm (e.g., <ToolInfo.Code>HS256</ToolInfo.Code>, <ToolInfo.Code>RS256</ToolInfo.Code>, <ToolInfo.Code>ES256</ToolInfo.Code>) and token type. The <ToolInfo.Strong>payload</ToolInfo.Strong> contains claims — key-value pairs like <ToolInfo.Code>sub</ToolInfo.Code>, <ToolInfo.Code>iat</ToolInfo.Code>, <ToolInfo.Code>exp</ToolInfo.Code>, and custom data. The <ToolInfo.Strong>signature</ToolInfo.Strong> is computed over the header and payload using a secret or private key, ensuring the token hasn&apos;t been tampered with.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Paste a JWT string to instantly decode the <ToolInfo.Strong>header</ToolInfo.Strong> and <ToolInfo.Strong>payload</ToolInfo.Strong></li>
          <li>View registered claims like <ToolInfo.Code>exp</ToolInfo.Code>, <ToolInfo.Code>iat</ToolInfo.Code>, and <ToolInfo.Code>nbf</ToolInfo.Code> with human-readable timestamps</li>
          <li>Check whether the token is expired at a glance</li>
          <li>Inspect the signing algorithm and key ID (<ToolInfo.Code>kid</ToolInfo.Code>) from the header</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Debugging <ToolInfo.Code>Authorization: Bearer</ToolInfo.Code> tokens from API requests</li>
          <li>Verifying token expiration and claims during development</li>
          <li>Inspecting OAuth 2.0 and OpenID Connect ID tokens</li>
          <li>Checking the algorithm and structure of tokens from third-party services</li>
        </ToolInfo.UL>
      </ToolInfo>
    </ToolLayout>
  );
}

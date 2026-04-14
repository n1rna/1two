import { HtpasswdTool } from "@/components/tools/htpasswd-tool";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "htpasswd",
  title: "htpasswd Generator - bcrypt, SHA-256, SHA-512, MD5, SSHA",
  description:
    "Generate htpasswd password hashes for HTTP basic authentication. Supports bcrypt, SHA-256, SHA-512, MD5 (apr1), and SSHA with salt display and .htpasswd file download.",
  keywords: [
    "htpasswd",
    "basic auth",
    "password hash",
    "bcrypt",
    "sha256",
    "sha512",
    "md5",
    "ssha",
    "apache",
    "nginx",
    "http auth",
  ],
});

export default function HtpasswdPage() {
  const jsonLd = toolJsonLd("htpasswd");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <HtpasswdTool />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is htpasswd?</ToolInfo.H2>
          <ToolInfo.P>
            <ToolInfo.Code>htpasswd</ToolInfo.Code> is a file format used by Apache and Nginx to store username-password pairs for HTTP Basic Authentication. Each line contains a username and a hashed password separated by a colon, e.g., <ToolInfo.Code>user:$2y$05$...</ToolInfo.Code>.
          </ToolInfo.P>

          <ToolInfo.H2>Supported algorithms</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Code>bcrypt</ToolInfo.Code> - the recommended algorithm, uses adaptive cost factor for brute-force resistance</li>
            <li><ToolInfo.Code>SHA-256</ToolInfo.Code> / <ToolInfo.Code>SHA-512</ToolInfo.Code> - Linux crypt-style hashes with random salts</li>
            <li><ToolInfo.Code>MD5 (apr1)</ToolInfo.Code> - Apache-specific MD5 variant, widely compatible but less secure</li>
            <li><ToolInfo.Code>SSHA</ToolInfo.Code> - salted SHA-1, used in LDAP-style configurations</li>
          </ToolInfo.UL>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Enter a <ToolInfo.Strong>username</ToolInfo.Strong> and <ToolInfo.Strong>password</ToolInfo.Strong> (or generate a random one)</li>
            <li>Select a <ToolInfo.Strong>hashing algorithm</ToolInfo.Strong> - <ToolInfo.Code>bcrypt</ToolInfo.Code> is recommended for new setups</li>
            <li>Copy the generated <ToolInfo.Code>.htpasswd</ToolInfo.Code> line or download the file</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Protecting staging environments or admin panels with Basic Auth on Apache or Nginx</li>
            <li>Generating password entries for <ToolInfo.Code>.htpasswd</ToolInfo.Code> files without CLI access</li>
            <li>Creating credentials for Docker registry authentication</li>
            <li>Setting up Basic Auth on reverse proxies like Traefik or Caddy</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}

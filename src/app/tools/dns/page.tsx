import { ToolInfo } from "@/components/layout/tool-info";
import { DnsTool } from "@/components/tools/dns-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "dns",
  title: "DNS Lookup",
  description:
    "Look up DNS records for any domain - A, AAAA, MX, CNAME, TXT, NS, SOA, SRV, CAA, and PTR.",
  keywords: [
    "dns lookup",
    "dns records",
    "domain lookup",
    "mx records",
    "nameserver lookup",
    "nslookup",
    "dig online",
    "txt records",
    "cname lookup",
  ],
});

export default function DnsPage() {
  const jsonLd = toolJsonLd("dns");
  return (
    <DnsTool>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}

      <ToolInfo>
        <ToolInfo.H2>What is DNS?</ToolInfo.H2>
        <ToolInfo.P>
          The Domain Name System (DNS) translates human-readable domain names like <ToolInfo.Code>example.com</ToolInfo.Code> into IP addresses that computers use to communicate. DNS records contain different types of information - from IP addresses (<ToolInfo.Code>A</ToolInfo.Code>, <ToolInfo.Code>AAAA</ToolInfo.Code>) to mail servers (<ToolInfo.Code>MX</ToolInfo.Code>) and verification strings (<ToolInfo.Code>TXT</ToolInfo.Code>).
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          When you look up a domain, DNS resolvers query authoritative nameservers to retrieve the requested record types. Each record type serves a different purpose - <ToolInfo.Code>A</ToolInfo.Code> records map to IPv4 addresses, <ToolInfo.Code>CNAME</ToolInfo.Code> records create aliases, <ToolInfo.Code>MX</ToolInfo.Code> records route email, and <ToolInfo.Code>TXT</ToolInfo.Code> records store arbitrary text like SPF policies or domain verification tokens.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Enter a <ToolInfo.Strong>domain name</ToolInfo.Strong> to look up its DNS records</li>
          <li>Select specific record types: <ToolInfo.Code>A</ToolInfo.Code>, <ToolInfo.Code>AAAA</ToolInfo.Code>, <ToolInfo.Code>MX</ToolInfo.Code>, <ToolInfo.Code>CNAME</ToolInfo.Code>, <ToolInfo.Code>TXT</ToolInfo.Code>, <ToolInfo.Code>NS</ToolInfo.Code>, <ToolInfo.Code>SOA</ToolInfo.Code>, <ToolInfo.Code>SRV</ToolInfo.Code>, <ToolInfo.Code>CAA</ToolInfo.Code>, or <ToolInfo.Code>PTR</ToolInfo.Code></li>
          <li>View results with TTL values, priorities, and full record data</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Verifying DNS propagation after updating nameservers or records</li>
          <li>Debugging email delivery issues by checking <ToolInfo.Code>MX</ToolInfo.Code> and <ToolInfo.Code>TXT</ToolInfo.Code> (SPF/DKIM) records</li>
          <li>Confirming domain ownership via <ToolInfo.Code>TXT</ToolInfo.Code> verification records</li>
          <li>Checking <ToolInfo.Code>CNAME</ToolInfo.Code> and <ToolInfo.Code>A</ToolInfo.Code> records when setting up CDNs or hosting</li>
        </ToolInfo.UL>


      </ToolInfo>
    </DnsTool>
  );
}

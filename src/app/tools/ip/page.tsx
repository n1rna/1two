import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { IpTool } from "@/components/tools/ip-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "ip",
  title: "What Is My IP Address - Geolocation & Network Info",
  description:
    "View your public IP address, geolocation, ISP, and network details. Also available via curl 1two.dev/ip from your terminal.",
  keywords: [
    "ip address",
    "what is my ip",
    "my ip",
    "ip lookup",
    "geolocation",
    "ip location",
    "isp",
    "network info",
    "curl ip",
  ],
});

export default function IpPage() {
  const jsonLd = toolJsonLd("ip");
  return (
    <ToolLayout slug="ip">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <IpTool />

      <ToolInfo>
        <ToolInfo.H2>What is an IP address?</ToolInfo.H2>
        <ToolInfo.P>
          An IP (Internet Protocol) address is a unique numerical identifier assigned to every device connected to a network. <ToolInfo.Code>IPv4</ToolInfo.Code> addresses use four octets (e.g., <ToolInfo.Code>192.168.1.1</ToolInfo.Code>), while <ToolInfo.Code>IPv6</ToolInfo.Code> addresses use a longer hexadecimal format. Your public IP address is how websites and services identify your connection.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          When you visit a website, your device sends requests from its public IP address, which is assigned by your Internet Service Provider (ISP). This tool queries a geolocation API to look up the location, ISP, and network details associated with your IP address.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Open the page to instantly see your <ToolInfo.Strong>public IP address</ToolInfo.Strong></li>
          <li>View <ToolInfo.Strong>geolocation data</ToolInfo.Strong> including city, region, country, and coordinates</li>
          <li>Check your <ToolInfo.Strong>ISP</ToolInfo.Strong> and network organization details</li>
          <li>Use <ToolInfo.Code>curl 1two.dev/ip</ToolInfo.Code> from a terminal to get your IP in plain text</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Checking your public IP when configuring firewalls or allowlists</li>
          <li>Verifying VPN or proxy connections are active</li>
          <li>Debugging network issues by confirming your visible IP address</li>
          <li>Quick IP lookup from the terminal with <ToolInfo.Code>curl</ToolInfo.Code></li>
        </ToolInfo.UL>
      </ToolInfo>
    </ToolLayout>
  );
}

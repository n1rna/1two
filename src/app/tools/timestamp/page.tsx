import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { TimestampTool } from "@/components/tools/timestamp-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "timestamp",
  title: "Unix Timestamp Converter",
  description:
    "Convert Unix timestamps to human-readable dates and vice versa. Supports ISO 8601, RFC 3339, RFC 2822, and millisecond timestamps with timezone selection.",
  keywords: [
    "unix timestamp converter",
    "epoch converter",
    "timestamp to date",
    "date to timestamp",
    "iso 8601",
    "rfc 3339",
    "rfc 2822",
    "epoch time",
    "unix time",
    "datetime converter",
    "utc converter",
  ],
});

export default function TimestampPage() {
  const jsonLd = toolJsonLd("timestamp");
  return (
    <ToolLayout slug="timestamp">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <TimestampTool />

      <ToolInfo>
        <ToolInfo.H2>What is a Unix timestamp?</ToolInfo.H2>
        <ToolInfo.P>
          A Unix timestamp (also called epoch time) is the number of seconds that have elapsed since <ToolInfo.Code>January 1, 1970 00:00:00 UTC</ToolInfo.Code>. It is a widely used format for representing points in time as a single integer, making it easy to store, compare, and transmit across systems regardless of timezone.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          Timestamps can be expressed in seconds (10 digits, e.g., <ToolInfo.Code>1700000000</ToolInfo.Code>) or milliseconds (13 digits). Common human-readable formats include <ToolInfo.Code>ISO 8601</ToolInfo.Code> (e.g., <ToolInfo.Code>2024-01-15T10:30:00Z</ToolInfo.Code>), <ToolInfo.Code>RFC 3339</ToolInfo.Code>, and <ToolInfo.Code>RFC 2822</ToolInfo.Code> (used in email headers). Converting between these formats requires knowing the timezone offset.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Enter a <ToolInfo.Strong>Unix timestamp</ToolInfo.Strong> (seconds or milliseconds) to see the corresponding date and time</li>
          <li>Enter a <ToolInfo.Strong>human-readable date</ToolInfo.Strong> to convert it to a Unix timestamp</li>
          <li>View the result in multiple formats: <ToolInfo.Code>ISO 8601</ToolInfo.Code>, <ToolInfo.Code>RFC 2822</ToolInfo.Code>, local time, and relative time</li>
          <li>Select a <ToolInfo.Strong>timezone</ToolInfo.Strong> to see the conversion in a specific region</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Converting timestamps from API responses or database records to readable dates</li>
          <li>Generating Unix timestamps for <ToolInfo.Code>exp</ToolInfo.Code> and <ToolInfo.Code>iat</ToolInfo.Code> claims in JWTs</li>
          <li>Debugging time-related bugs by comparing timestamps across timezones</li>
          <li>Converting between <ToolInfo.Code>ISO 8601</ToolInfo.Code>, <ToolInfo.Code>RFC 2822</ToolInfo.Code>, and epoch formats</li>
        </ToolInfo.UL>
      </ToolInfo>
    </ToolLayout>
  );
}

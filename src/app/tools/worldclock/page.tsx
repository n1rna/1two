import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";
import { ToolInfo } from "@/components/layout/tool-info";
import { WorldClockPage as WorldClockClient } from "@/components/tools/worldclock-tool";

export const metadata = toolMetadata({
  slug: "worldclock",
  title: "World Clock & Timezone Overlap Finder",
  description:
    "Live clocks for your favorite timezones and a visual 24-hour overlap finder to schedule meetings across time zones.",
  keywords: [
    "world clock",
    "timezone converter",
    "meeting time finder",
    "timezone overlap",
    "utc converter",
    "international time",
    "schedule meeting",
    "time zone",
  ],
});

export default function WorldClockPage() {
  const jsonLd = toolJsonLd("worldclock");
  return (
    <>
      <WorldClockClient jsonLd={jsonLd} />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is a world clock?</ToolInfo.H2>
          <ToolInfo.P>
            A world clock displays the current time across multiple timezones simultaneously. This tool also includes a visual overlap finder that shows working-hour windows across timezones, making it easy to schedule meetings with people in different regions.
          </ToolInfo.P>

          <ToolInfo.H2>How it works</ToolInfo.H2>
          <ToolInfo.P>
            Timezones are defined as offsets from <ToolInfo.Code>UTC</ToolInfo.Code> (Coordinated Universal Time). The IANA timezone database (e.g., <ToolInfo.Code>America/New_York</ToolInfo.Code>, <ToolInfo.Code>Europe/London</ToolInfo.Code>) maps region names to their current UTC offset, accounting for daylight saving time transitions automatically.
          </ToolInfo.P>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Add <ToolInfo.Strong>timezones</ToolInfo.Strong> to see live clocks side by side</li>
            <li>Use the <ToolInfo.Strong>overlap finder</ToolInfo.Strong> to visualize shared working hours across all added timezones</li>
            <li>Click on a time slot to see the corresponding time in every timezone</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Finding overlapping working hours for distributed teams</li>
            <li>Scheduling meetings across <ToolInfo.Code>US/Pacific</ToolInfo.Code>, <ToolInfo.Code>Europe/Berlin</ToolInfo.Code>, and <ToolInfo.Code>Asia/Tokyo</ToolInfo.Code></li>
            <li>Checking the current time for clients or colleagues in other regions</li>
            <li>Planning deployment windows in production timezones</li>
          </ToolInfo.UL>


        </ToolInfo>
      </div>
    </>
  );
}

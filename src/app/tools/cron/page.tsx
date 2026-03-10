import { CronBuilder } from "@/components/tools/cron-builder";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "cron",
  title: "Cron Expression Builder & Parser",
  description:
    "Build, parse, and understand cron schedule expressions with a visual editor. See next run times, use presets, and generate crontab syntax for any schedule.",
  keywords: [
    "cron builder",
    "cron expression",
    "crontab generator",
    "cron parser",
    "cron schedule",
    "cron job",
    "crontab syntax",
    "cron next run",
    "cron visualizer",
    "schedule expression",
  ],
});

export default function CronPage() {
  const jsonLd = toolJsonLd("cron");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <CronBuilder />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is a cron expression?</ToolInfo.H2>
          <ToolInfo.P>
            A cron expression is a string of five (or six) fields that defines a recurring schedule. The standard format is <ToolInfo.Code>minute hour day-of-month month day-of-week</ToolInfo.Code>. Cron is used by Unix-like systems, CI/CD pipelines, cloud schedulers, and task runners to trigger jobs at specific times.
          </ToolInfo.P>

          <ToolInfo.H2>How it works</ToolInfo.H2>
          <ToolInfo.P>
            Each field accepts specific values, ranges (<ToolInfo.Code>1-5</ToolInfo.Code>), lists (<ToolInfo.Code>1,3,5</ToolInfo.Code>), steps (<ToolInfo.Code>*/15</ToolInfo.Code>), or wildcards (<ToolInfo.Code>*</ToolInfo.Code>). For example, <ToolInfo.Code>0 9 * * 1-5</ToolInfo.Code> means &quot;at 9:00 AM, Monday through Friday.&quot; The day-of-week field uses <ToolInfo.Code>0</ToolInfo.Code> (Sunday) through <ToolInfo.Code>6</ToolInfo.Code> (Saturday).
          </ToolInfo.P>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Type a <ToolInfo.Strong>cron expression</ToolInfo.Strong> to see a human-readable description and upcoming run times</li>
            <li>Use the <ToolInfo.Strong>visual editor</ToolInfo.Strong> to build expressions by selecting values for each field</li>
            <li>Pick from <ToolInfo.Strong>presets</ToolInfo.Strong> for common schedules (every minute, hourly, daily, weekly)</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Scheduling database backups with <ToolInfo.Code>crontab</ToolInfo.Code></li>
            <li>Configuring CI/CD pipeline triggers (GitHub Actions, GitLab CI)</li>
            <li>Setting up recurring tasks in cloud services (AWS EventBridge, GCP Cloud Scheduler)</li>
            <li>Debugging why a cron job isn&apos;t firing at the expected time</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}

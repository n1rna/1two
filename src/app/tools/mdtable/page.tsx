import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { MarkdownTableGenerator } from "@/components/tools/markdown-table-generator";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "mdtable",
  title: "Markdown Table Generator",
  description:
    "Build markdown tables visually - add rows and columns, edit cells inline, paste CSV data, and generate clean aligned markdown output.",
  keywords: [
    "markdown table",
    "markdown table generator",
    "md table",
    "table to markdown",
    "csv to markdown",
    "github markdown table",
    "aligned markdown",
  ],
});

export default function MarkdownTablePage() {
  const jsonLd = toolJsonLd("mdtable");
  return (
    <ToolLayout slug="mdtable">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <MarkdownTableGenerator />

      <ToolInfo>
        <ToolInfo.H2>What are markdown tables?</ToolInfo.H2>
        <ToolInfo.P>
          Markdown tables are a lightweight syntax for creating tabular data in plain text. They use pipes (<ToolInfo.Code>|</ToolInfo.Code>) to separate columns and hyphens (<ToolInfo.Code>-</ToolInfo.Code>) for the header separator row. Supported by GitHub, GitLab, Reddit, and most markdown renderers.
        </ToolInfo.P>

        <ToolInfo.H2>How it works</ToolInfo.H2>
        <ToolInfo.P>
          A markdown table has a header row, a separator row, and data rows. The separator row can include colons to control alignment: <ToolInfo.Code>:---</ToolInfo.Code> for left, <ToolInfo.Code>:--:</ToolInfo.Code> for center, and <ToolInfo.Code>---:</ToolInfo.Code> for right. This tool generates clean, padded output where columns are aligned with spaces for readability in source form.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Edit <ToolInfo.Strong>headers</ToolInfo.Strong> and <ToolInfo.Strong>cells</ToolInfo.Strong> inline - the markdown output updates in real time</li>
          <li>Add or remove <ToolInfo.Strong>rows</ToolInfo.Strong> and <ToolInfo.Strong>columns</ToolInfo.Strong> with the toolbar buttons or the side controls</li>
          <li>Click the <ToolInfo.Strong>alignment icon</ToolInfo.Strong> on each column header to cycle between left, center, and right alignment</li>
          <li>Paste <ToolInfo.Strong>CSV or tab-separated data</ToolInfo.Strong> into any cell to auto-expand the table</li>
          <li>Copy the generated markdown with the <ToolInfo.Strong>Copy</ToolInfo.Strong> button</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Creating tables for GitHub README files, issues, and pull request descriptions</li>
          <li>Converting CSV data into clean markdown for documentation</li>
          <li>Building comparison tables for blog posts or wikis</li>
          <li>Formatting API parameter lists or configuration references</li>
        </ToolInfo.UL>
      </ToolInfo>
    </ToolLayout>
  );
}

import { CsvViewer } from "@/components/tools/csv-viewer";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "csv",
  title: "CSV Viewer & Editor",
  description:
    "Open, view, edit, search, and export CSV files in the browser with data science split presets",
  keywords: [
    "csv",
    "csv viewer",
    "csv editor",
    "tsv",
    "data",
    "export",
    "train test split",
    "sample",
  ],
});

export default function CsvPage() {
  const jsonLd = toolJsonLd("csv");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <CsvViewer />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is CSV?</ToolInfo.H2>
          <ToolInfo.P>
            CSV (Comma-Separated Values) is a plain-text format for tabular data where each line represents a row and values are separated by a delimiter - typically a comma (<ToolInfo.Code>,</ToolInfo.Code>) or tab (<ToolInfo.Code>\t</ToolInfo.Code> for TSV). It&apos;s the most common interchange format for spreadsheets, databases, and data pipelines.
          </ToolInfo.P>

          <ToolInfo.H2>How it works</ToolInfo.H2>
          <ToolInfo.P>
            This viewer parses CSV and TSV files entirely in the browser using auto-detected delimiters. It renders data in a virtualized table for performance with large files, supports inline editing, column sorting, search, and data science split presets (train/test/validation).
          </ToolInfo.P>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Strong>Drag & drop</ToolInfo.Strong> a <ToolInfo.Code>.csv</ToolInfo.Code> or <ToolInfo.Code>.tsv</ToolInfo.Code> file, or click to browse</li>
            <li>Sort columns, <ToolInfo.Strong>search</ToolInfo.Strong> across all fields, and edit cells inline</li>
            <li>Use <ToolInfo.Strong>split presets</ToolInfo.Strong> to partition data into train/test sets</li>
            <li>Export modified data back to CSV</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Previewing CSV exports from databases or APIs</li>
            <li>Quick edits to data files without opening Excel or Google Sheets</li>
            <li>Splitting datasets for machine learning workflows</li>
            <li>Inspecting TSV files from bioinformatics or log pipelines</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}

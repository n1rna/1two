import { ToolLayout } from "@/components/layout/tool-layout";
import { ToolInfo } from "@/components/layout/tool-info";
import { UploadTool } from "@/components/tools/upload-tool";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "upload",
  title: "File Upload",
  description:
    "Upload, manage, and share files securely with your account.",
  keywords: [
    "file upload",
    "file sharing",
    "cloud storage",
    "upload files",
    "file manager",
  ],
});

export default function UploadPage() {
  const jsonLd = toolJsonLd("upload");
  return (
    <ToolLayout slug="upload">
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <UploadTool />

      <ToolInfo>
        <ToolInfo.H2>What is this tool?</ToolInfo.H2>
        <ToolInfo.P>
          A simple file upload and sharing service tied to your 1two.dev account. Upload files, get shareable links, and manage your uploads from one place.
        </ToolInfo.P>

        <ToolInfo.H2>How to use this tool</ToolInfo.H2>
        <ToolInfo.UL>
          <li><ToolInfo.Strong>Sign in</ToolInfo.Strong> to upload and manage files</li>
          <li>Drag and drop files or click to browse</li>
          <li>Get a <ToolInfo.Strong>shareable link</ToolInfo.Strong> for each uploaded file</li>
          <li>Delete files when you no longer need them</li>
        </ToolInfo.UL>

        <ToolInfo.H2>Common use cases</ToolInfo.H2>
        <ToolInfo.UL>
          <li>Sharing screenshots, documents, or assets with teammates</li>
          <li>Hosting small files for quick access via a direct URL</li>
          <li>Temporary file sharing without third-party services</li>
        </ToolInfo.UL>
      </ToolInfo>
    </ToolLayout>
  );
}

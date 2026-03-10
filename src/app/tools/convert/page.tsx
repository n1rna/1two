import { VideoConverter } from "@/components/tools/video-converter";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "convert",
  title: "Video Converter",
  description:
    "Extract video metadata, compress videos, and convert between MP4, WebM, MOV, MKV, and more.",
  keywords: ["video converter", "compress video", "transcode", "mp4", "webm", "mkv", "mov", "codec", "bitrate"],
});

export default function VideoConverterPage() {
  const jsonLd = toolJsonLd("convert");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <VideoConverter />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is this video converter?</ToolInfo.H2>
          <ToolInfo.P>
            A client-side video converter powered by <ToolInfo.Code>FFmpeg WebAssembly</ToolInfo.Code>. It transcodes, compresses, and extracts metadata from video files entirely in your browser — no files are uploaded to any server.
          </ToolInfo.P>

          <ToolInfo.H2>Supported formats</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Code>MP4</ToolInfo.Code> — H.264/H.265 container, widely compatible</li>
            <li><ToolInfo.Code>WebM</ToolInfo.Code> — VP8/VP9 with Opus audio, optimized for web</li>
            <li><ToolInfo.Code>MKV</ToolInfo.Code> — Matroska container supporting virtually any codec</li>
            <li><ToolInfo.Code>MOV</ToolInfo.Code> — Apple QuickTime format</li>
          </ToolInfo.UL>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Strong>Drag & drop</ToolInfo.Strong> a video file or click to browse</li>
            <li>View extracted <ToolInfo.Strong>metadata</ToolInfo.Strong> including codec, resolution, bitrate, and duration</li>
            <li>Choose an <ToolInfo.Strong>output format</ToolInfo.Strong> and adjust compression settings</li>
            <li>Download the converted file directly from the browser</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Converting screen recordings to web-friendly <ToolInfo.Code>MP4</ToolInfo.Code> or <ToolInfo.Code>WebM</ToolInfo.Code></li>
            <li>Compressing large video files before sharing or uploading</li>
            <li>Extracting video metadata without installing desktop tools</li>
            <li>Converting between container formats for compatibility</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}

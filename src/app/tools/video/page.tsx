import { VideoPlayer } from "@/components/tools/video-player";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "video",
  title: "Video Player",
  description:
    "Play local or remote video files with metadata inspection, custom controls, and media info.",
  keywords: ["video player", "media player", "mp4", "webm", "hls", "stream", "play video online"],
});

export default function VideoPlayerPage() {
  const jsonLd = toolJsonLd("video");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <VideoPlayer />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What is this video player?</ToolInfo.H2>
          <ToolInfo.P>
            A browser-based video player that opens local files or remote URLs without uploading anything to a server. It inspects media metadata, displays codec info, resolution, duration, and bitrate — all processed client-side using the browser&apos;s native <ToolInfo.Code>HTMLVideoElement</ToolInfo.Code> API.
          </ToolInfo.P>

          <ToolInfo.H2>Supported formats</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Code>MP4</ToolInfo.Code> — H.264/H.265 video with AAC audio, universally supported</li>
            <li><ToolInfo.Code>WebM</ToolInfo.Code> — VP8/VP9/AV1 video with Opus audio</li>
            <li><ToolInfo.Code>HLS</ToolInfo.Code> — HTTP Live Streaming via <ToolInfo.Code>.m3u8</ToolInfo.Code> playlist URLs</li>
            <li><ToolInfo.Code>OGG</ToolInfo.Code> — Theora video with Vorbis audio</li>
          </ToolInfo.UL>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li><ToolInfo.Strong>Drag & drop</ToolInfo.Strong> a video file or click to browse your files</li>
            <li>Enter a <ToolInfo.Strong>remote URL</ToolInfo.Strong> to stream video directly</li>
            <li>View <ToolInfo.Strong>metadata</ToolInfo.Strong> including resolution, codec, duration, and file size</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Previewing video files without installing a desktop player</li>
            <li>Checking video metadata and codec information before processing</li>
            <li>Testing HLS streams and remote video URLs</li>
            <li>Quick playback of screen recordings or downloaded clips</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}

import { VideoPlayer } from "@/components/tools/video-player";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Player — 1two.dev",
  description: "Play local or remote video files with custom controls and media info",
};

export default function VideoPlayerPage() {
  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      <VideoPlayer />
    </>
  );
}

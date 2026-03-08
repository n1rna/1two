import { VideoConverter } from "@/components/tools/video-converter";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Converter — 1two.dev",
  description:
    "Extract video metadata, compress videos, and convert between MP4, WebM, MOV, and more",
};

export default function VideoConverterPage() {
  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      <VideoConverter />
    </>
  );
}

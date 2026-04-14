import { WebcamTester } from "@/components/tools/webcam-tester";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "webcam",
  title: "Online Webcam Test - Check Camera, Resolution & Record Video",
  description:
    "Test your webcam online for free. See live camera preview with brightness analysis, resolution check, real-time FPS monitoring, and diagnostics. Capture frames, record video clips, and download. No installation required.",
  keywords: [
    "webcam test",
    "test webcam online",
    "camera test",
    "webcam checker",
    "webcam resolution",
    "camera preview",
    "webcam capture",
    "video device test",
    "webcam online",
    "check webcam",
    "webcam not working",
    "test camera before zoom",
    "browser camera test",
    "is my webcam working",
    "webcam quality test",
    "webcam fps test",
    "webcam brightness test",
    "webcam video recording",
  ],
});

export default function WebcamPage() {
  const jsonLd = toolJsonLd("webcam");

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is this webcam test free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, this webcam test is completely free. No sign-up, no installation, and no video data leaves your browser.",
        },
      },
      {
        "@type": "Question",
        name: "Does this tool upload my video?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. All video processing happens entirely in your browser using the Web API. Nothing is sent to any server. Captures and recordings are stored only in your browser's memory and are lost when you close the tab.",
        },
      },
      {
        "@type": "Question",
        name: "Why is my webcam not detected?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The most common causes are: 1) You denied camera permission — click the lock icon in your address bar to reset permissions. 2) Another application like Zoom, Teams, or Skype is exclusively using the camera. 3) Your camera is disabled in your operating system's privacy settings. 4) The camera is physically disconnected or covered by a privacy shutter.",
        },
      },
      {
        "@type": "Question",
        name: "How do I test my webcam before a Zoom or Teams call?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Click Start to open your camera. The diagnostic panel will tell you if your webcam is working, check your resolution, frame rate stability, and lighting conditions. If everything shows green, your camera is ready for your call.",
        },
      },
      {
        "@type": "Question",
        name: "What resolution should my webcam be?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "For video calls, 720p (1280×720) is the minimum recommended resolution. 1080p (1920×1080) is ideal for a sharp, professional image. The tool shows your actual resolution and flags it if it's below HD quality.",
        },
      },
      {
        "@type": "Question",
        name: "Why is my webcam image too dark or overexposed?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The brightness meter shows your current lighting conditions. If too dark, add a light source facing you (not behind you). If overexposed, reduce direct light on your face or adjust your camera's exposure settings in your OS preferences.",
        },
      },
    ],
  };

  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <WebcamTester />
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <ToolInfo>
          <ToolInfo.H2>How to test your webcam online</ToolInfo.H2>
          <ToolInfo.UL>
            <li>
              Click <ToolInfo.Strong>Start</ToolInfo.Strong> and allow camera
              access when prompted by your browser
            </li>
            <li>
              The live preview shows your camera feed immediately — check
              framing, focus, and lighting
            </li>
            <li>
              After a few seconds, a{" "}
              <ToolInfo.Strong>diagnostic panel</ToolInfo.Strong> appears
              confirming whether your webcam is working, with checks for
              resolution, frame rate, and brightness
            </li>
            <li>
              Click <ToolInfo.Strong>Capture</ToolInfo.Strong> to take a
              screenshot — captures appear in a gallery below the preview with
              copy, download, and delete options
            </li>
            <li>
              Click <ToolInfo.Strong>Record</ToolInfo.Strong> to capture a video
              clip. Recordings can be played back and downloaded as WebM files
            </li>
          </ToolInfo.UL>

          <ToolInfo.H2>Understanding webcam specifications</ToolInfo.H2>
          <ToolInfo.UL>
            <li>
              <ToolInfo.Strong>Resolution</ToolInfo.Strong> — the number of
              pixels your camera captures. Common resolutions are{" "}
              <ToolInfo.Code>720p</ToolInfo.Code> (1280&times;720),{" "}
              <ToolInfo.Code>1080p</ToolInfo.Code> (1920&times;1080), and{" "}
              <ToolInfo.Code>4K</ToolInfo.Code> (3840&times;2160)
            </li>
            <li>
              <ToolInfo.Strong>Frame Rate</ToolInfo.Strong> — how many frames
              per second (fps) the camera delivers.{" "}
              <ToolInfo.Code>30 fps</ToolInfo.Code> is standard for video calls;{" "}
              <ToolInfo.Code>60 fps</ToolInfo.Code> produces smoother motion
            </li>
            <li>
              <ToolInfo.Strong>Actual FPS</ToolInfo.Strong> — the real measured
              frame rate in your browser, which may be lower than the camera's
              capability due to CPU load, other tabs, or USB bandwidth
            </li>
            <li>
              <ToolInfo.Strong>Brightness</ToolInfo.Strong> — a real-time
              assessment of your lighting. Good lighting is the single biggest
              factor in webcam image quality, more important than resolution
            </li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common webcam problems</ToolInfo.H2>
          <ToolInfo.UL>
            <li>
              <ToolInfo.Strong>Camera not detected</ToolInfo.Strong> — check
              browser permissions, close other apps that may have exclusive
              camera access (Zoom, Teams, Skype), and verify the device is
              enabled in OS privacy settings
            </li>
            <li>
              <ToolInfo.Strong>Low resolution</ToolInfo.Strong> — another app
              may be using the camera at a lower resolution. Close other video
              apps and restart the test. Some laptops default to 720p even if
              the camera supports 1080p
            </li>
            <li>
              <ToolInfo.Strong>Dropped frames / stuttering</ToolInfo.Strong> —
              close other browser tabs and applications. USB bandwidth
              limitations can also cause frame drops when multiple USB devices
              are active
            </li>
            <li>
              <ToolInfo.Strong>Too dark</ToolInfo.Strong> — position a light
              source in front of you, not behind. A desk lamp or window facing
              you works well. Avoid backlighting from windows behind your head
            </li>
            <li>
              <ToolInfo.Strong>Overexposed / washed out</ToolInfo.Strong> —
              reduce direct light on your face, close blinds if sunlight is too
              strong, or adjust exposure in your operating system camera settings
            </li>
          </ToolInfo.UL>

          <ToolInfo.H2>Privacy</ToolInfo.H2>
          <ToolInfo.P>
            This tool runs entirely in your browser. Video is processed locally
            using the <ToolInfo.Code>getUserMedia</ToolInfo.Code> and{" "}
            <ToolInfo.Code>MediaRecorder</ToolInfo.Code> APIs. No video data is
            transmitted to any server. Captures and recordings exist only in
            browser memory and are discarded when the page is closed.
          </ToolInfo.P>
        </ToolInfo>
      </div>
    </>
  );
}

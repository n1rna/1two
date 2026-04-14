import { MicrophoneTester } from "@/components/tools/microphone-tester";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "microphone",
  title: "Online Microphone Test - Check Mic, Audio Levels & Record",
  description:
    "Test your microphone online for free. See live audio levels, frequency spectrum, background noise, and clipping detection. Record clips, test for echo, and diagnose common mic problems. No installation required.",
  keywords: [
    "microphone test",
    "test microphone online",
    "mic test",
    "mic checker",
    "audio test",
    "microphone level",
    "sound test",
    "mic recording test",
    "audio device test",
    "check microphone",
    "microphone not working",
    "test mic before zoom",
    "browser microphone test",
    "is my mic working",
    "microphone volume test",
    "echo test",
    "microphone echo detection",
    "background noise test",
  ],
});

export default function MicrophonePage() {
  const jsonLd = toolJsonLd("microphone");

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is this microphone test free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, this microphone test is completely free. No sign-up, no installation, and no data leaves your browser.",
        },
      },
      {
        "@type": "Question",
        name: "Does this tool record or upload my audio?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. All audio processing happens entirely in your browser using the Web Audio API. Nothing is sent to any server. Recordings are stored only in your browser's memory and are lost when you close the tab.",
        },
      },
      {
        "@type": "Question",
        name: "What browsers support online microphone testing?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "All modern browsers support the Web Audio API and getUserMedia required for microphone testing, including Chrome, Firefox, Safari, and Edge. Make sure your browser is up to date for the best experience.",
        },
      },
      {
        "@type": "Question",
        name: "Why can't the site detect my microphone?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "The most common causes are: 1) You denied microphone permission — click the lock icon in your address bar to reset permissions. 2) Another app is exclusively using the microphone. 3) Your microphone is disabled in your operating system's sound settings. 4) The microphone is physically disconnected or muted via a hardware switch.",
        },
      },
      {
        "@type": "Question",
        name: "How do I test for echo or audio feedback?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "After starting the microphone test, wait for the diagnostic panel to appear, then click 'Test for echo'. The tool plays a brief tone through your speakers and checks whether your microphone picks it up. If echo is detected, try using headphones or moving your microphone away from your speakers.",
        },
      },
      {
        "@type": "Question",
        name: "What do dBFS and RMS mean?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "dBFS (decibels relative to full scale) measures how loud your signal is compared to the maximum possible level. 0 dBFS is the loudest; values are always negative. RMS (Root Mean Square) is the average signal level, giving a better representation of perceived loudness than peak level alone.",
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
      <MicrophoneTester />
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <ToolInfo>
          <ToolInfo.H2>How to test your microphone online</ToolInfo.H2>
          <ToolInfo.UL>
            <li>
              Click <ToolInfo.Strong>Start</ToolInfo.Strong> and allow
              microphone access when prompted by your browser
            </li>
            <li>
              Speak or make sound — the frequency spectrum and level meters
              respond in real time
            </li>
            <li>
              After a few seconds, a <ToolInfo.Strong>diagnostic panel</ToolInfo.Strong>{" "}
              appears confirming whether your mic is working, with details on
              signal strength, background noise, and clipping
            </li>
            <li>
              Click <ToolInfo.Strong>Record</ToolInfo.Strong> to capture a clip,
              then play it back to hear how you actually sound
            </li>
            <li>
              Use <ToolInfo.Strong>Test for echo</ToolInfo.Strong> to check if
              your speakers are feeding audio back into your microphone
            </li>
          </ToolInfo.UL>

          <ToolInfo.H2>Understanding audio levels</ToolInfo.H2>
          <ToolInfo.P>
            The tool displays three key measurements to help evaluate your
            microphone signal:
          </ToolInfo.P>
          <ToolInfo.UL>
            <li>
              <ToolInfo.Strong>Volume (RMS)</ToolInfo.Strong> — the average
              signal level, representing perceived loudness. For speech, aim for{" "}
              <ToolInfo.Code>20–60%</ToolInfo.Code>
            </li>
            <li>
              <ToolInfo.Strong>Peak</ToolInfo.Strong> — the highest instantaneous
              level. If this consistently hits <ToolInfo.Code>100%</ToolInfo.Code>,
              your signal is clipping and will sound distorted
            </li>
            <li>
              <ToolInfo.Strong>dBFS</ToolInfo.Strong> — decibels relative to
              full scale. <ToolInfo.Code>0 dBFS</ToolInfo.Code> is the maximum;
              typical speech lands between{" "}
              <ToolInfo.Code>-20</ToolInfo.Code> and{" "}
              <ToolInfo.Code>-6 dBFS</ToolInfo.Code>
            </li>
            <li>
              <ToolInfo.Strong>Noise Floor</ToolInfo.Strong> — the ambient noise
              level when you are not speaking. Below{" "}
              <ToolInfo.Code>-40 dB</ToolInfo.Code> is a quiet room; above{" "}
              <ToolInfo.Code>-28 dB</ToolInfo.Code> indicates significant
              background noise
            </li>
          </ToolInfo.UL>

          <ToolInfo.H2>Echo and feedback detection</ToolInfo.H2>
          <ToolInfo.P>
            Audio echo happens when your microphone picks up sound from your
            speakers, creating a feedback loop. This is common when using
            built-in laptop speakers and microphone together, or when two devices
            in the same room both have their microphones and speakers active. The
            echo test plays a brief <ToolInfo.Code>3 kHz</ToolInfo.Code> tone
            through your speakers and checks whether the microphone picks it up.
            If echo is detected, the best fix is to use headphones or reduce
            your speaker volume.
          </ToolInfo.P>

          <ToolInfo.H2>Common microphone problems</ToolInfo.H2>
          <ToolInfo.UL>
            <li>
              <ToolInfo.Strong>Mic not detected</ToolInfo.Strong> — check
              browser permissions, make sure no other app has exclusive access,
              and verify the device is enabled in your OS sound settings
            </li>
            <li>
              <ToolInfo.Strong>Signal too quiet</ToolInfo.Strong> — increase
              microphone gain in your system settings, move closer to the mic,
              or check if a hardware mute switch is engaged
            </li>
            <li>
              <ToolInfo.Strong>Clipping / distortion</ToolInfo.Strong> — reduce
              mic gain or move further from the microphone. The clipping counter
              shows how often the signal exceeds the maximum level
            </li>
            <li>
              <ToolInfo.Strong>Too much background noise</ToolInfo.Strong> —
              enable noise suppression (shown in device info), use a directional
              microphone, or move to a quieter environment
            </li>
            <li>
              <ToolInfo.Strong>Echo / feedback</ToolInfo.Strong> — use
              headphones, lower speaker volume, or enable echo cancellation in
              your audio settings
            </li>
          </ToolInfo.UL>

          <ToolInfo.H2>Privacy</ToolInfo.H2>
          <ToolInfo.P>
            This tool runs entirely in your browser. Audio is processed locally
            using the{" "}
            <ToolInfo.Code>Web Audio API</ToolInfo.Code> and{" "}
            <ToolInfo.Code>MediaRecorder API</ToolInfo.Code>. No audio data is
            transmitted to any server. Recordings exist only in browser memory
            and are discarded when the page is closed.
          </ToolInfo.P>
        </ToolInfo>
      </div>
    </>
  );
}

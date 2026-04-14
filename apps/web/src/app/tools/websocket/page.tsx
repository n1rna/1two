import { WebSocketTester } from "@/components/tools/websocket-tester";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "websocket",
  title: "WebSocket Tester",
  description:
    "Connect to WebSocket servers, send and receive messages, and inspect real-time traffic.",
  keywords: ["websocket tester", "ws client", "websocket client", "realtime", "socket", "wss"],
});

export default function WebSocketTesterPage() {
  const jsonLd = toolJsonLd("websocket");
  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <WebSocketTester />
      <noscript>
        <div className="max-w-6xl mx-auto px-6 pb-6">
          <ToolInfo>
            <ToolInfo.H2>What is WebSocket?</ToolInfo.H2>
            <ToolInfo.P>
              WebSocket is a communication protocol that provides full-duplex, persistent connections between a client and server over a single TCP connection. Unlike HTTP, which follows a request-response pattern, WebSocket allows both sides to send messages at any time after the initial handshake via <ToolInfo.Code>ws://</ToolInfo.Code> or <ToolInfo.Code>wss://</ToolInfo.Code> (TLS-encrypted).
            </ToolInfo.P>

            <ToolInfo.H2>How it works</ToolInfo.H2>
            <ToolInfo.P>
              A WebSocket connection starts with an HTTP upgrade request. Once upgraded, the connection stays open and both client and server can push frames - text or binary - without the overhead of new HTTP requests. The browser&apos;s <ToolInfo.Code>WebSocket</ToolInfo.Code> API handles framing, ping/pong keepalive, and close handshakes automatically.
            </ToolInfo.P>

            <ToolInfo.H2>How to use this tool</ToolInfo.H2>
            <ToolInfo.UL>
              <li>Enter a <ToolInfo.Strong>WebSocket URL</ToolInfo.Strong> (e.g., <ToolInfo.Code>wss://echo.websocket.org</ToolInfo.Code>) and connect</li>
              <li>Send <ToolInfo.Strong>text or JSON messages</ToolInfo.Strong> and see responses in real time</li>
              <li>Inspect the <ToolInfo.Strong>message log</ToolInfo.Strong> with timestamps, direction, and payload size</li>
            </ToolInfo.UL>

            <ToolInfo.H2>Common use cases</ToolInfo.H2>
            <ToolInfo.UL>
              <li>Testing WebSocket server endpoints during development</li>
              <li>Debugging real-time features like chat, notifications, or live updates</li>
              <li>Verifying message formats and server responses</li>
              <li>Load-testing WebSocket connections with custom payloads</li>
            </ToolInfo.UL>
          </ToolInfo>
        </div>
      </noscript>
    </>
  );
}

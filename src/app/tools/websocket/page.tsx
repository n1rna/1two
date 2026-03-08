import { WebSocketTester } from "@/components/tools/websocket-tester";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WebSocket Tester — 1two.dev",
  description:
    "Connect to WebSocket servers, send and receive messages, and inspect real-time traffic",
};

export default function WebSocketTesterPage() {
  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      <WebSocketTester />
    </>
  );
}

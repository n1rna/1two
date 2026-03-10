import { NotificationTester } from "@/components/tools/notification-tester";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "notifications",
  title: "Notification Tester",
  description:
    "Test push notifications, generate VAPID keys, subscribe to push services, and inspect incoming notifications.",
  keywords: ["notification tester", "push notification", "vapid", "web push", "service worker", "fcm"],
});

export default function NotificationTesterPage() {
  const jsonLd = toolJsonLd("notifications");
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
      <NotificationTester />
      <noscript>
        <div className="max-w-6xl mx-auto px-6 pb-6">
          <ToolInfo>
            <ToolInfo.H2>What are web push notifications?</ToolInfo.H2>
            <ToolInfo.P>
              Web push notifications allow websites to send messages to users even when the browser tab is closed. They use the <ToolInfo.Code>Push API</ToolInfo.Code> and <ToolInfo.Code>Notification API</ToolInfo.Code> together with a service worker to deliver real-time alerts. The protocol relies on <ToolInfo.Code>VAPID</ToolInfo.Code> (Voluntary Application Server Identification) keys for authentication between your server and the push service.
            </ToolInfo.P>

            <ToolInfo.H2>How it works</ToolInfo.H2>
            <ToolInfo.P>
              The browser requests permission, registers a service worker, and subscribes to a push service (e.g., FCM, Mozilla Push). The subscription contains an endpoint URL and encryption keys. Your server sends a push message to that endpoint, and the service worker receives it in the background and displays a notification via <ToolInfo.Code>self.registration.showNotification()</ToolInfo.Code>.
            </ToolInfo.P>

            <ToolInfo.H2>How to use this tool</ToolInfo.H2>
            <ToolInfo.UL>
              <li>Grant <ToolInfo.Strong>notification permission</ToolInfo.Strong> when prompted by the browser</li>
              <li>Generate or enter <ToolInfo.Strong>VAPID keys</ToolInfo.Strong> for push subscription</li>
              <li>Send <ToolInfo.Strong>test notifications</ToolInfo.Strong> and inspect them in the log</li>
            </ToolInfo.UL>

            <ToolInfo.H2>Common use cases</ToolInfo.H2>
            <ToolInfo.UL>
              <li>Testing push notification setup during PWA development</li>
              <li>Generating VAPID key pairs for server configuration</li>
              <li>Debugging notification permissions and subscription flow</li>
              <li>Verifying notification payloads and display formatting</li>
            </ToolInfo.UL>
          </ToolInfo>
        </div>
      </noscript>
    </>
  );
}

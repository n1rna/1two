import { NotificationTester } from "@/components/tools/notification-tester";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notification Tester — 1two.dev",
  description:
    "Test push notifications, generate VAPID keys, subscribe to push services, and inspect incoming notifications",
};

export default function NotificationTesterPage() {
  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      <NotificationTester />
    </>
  );
}

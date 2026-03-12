import { Metadata } from "next";
import { BillingDashboard } from "@/components/account/billing-dashboard";

export const metadata: Metadata = {
  title: "Billing - 1two",
  description: "Manage your subscription plan and usage",
};

export default function BillingPage() {
  return <BillingDashboard />;
}

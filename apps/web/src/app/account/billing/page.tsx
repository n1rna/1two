import { Metadata } from "next";
import { BillingDashboard } from "@/components/account/billing-dashboard";

export const metadata: Metadata = {
  title: "Billing - 1tt",
  description: "Manage your subscription plan and usage",
};

export default function BillingPage() {
  return <BillingDashboard />;
}

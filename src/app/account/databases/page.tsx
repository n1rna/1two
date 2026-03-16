import { Metadata } from "next";
import { DatabaseDashboard } from "@/components/account/database-dashboard";

export const metadata: Metadata = {
  title: "Databases - 1tt",
  description: "Manage your serverless Postgres databases",
};

export default function DatabasesPage() {
  return <DatabaseDashboard />;
}

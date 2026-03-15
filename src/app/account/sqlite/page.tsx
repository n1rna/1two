import { Metadata } from "next";
import { HostedSqliteDashboard } from "@/components/account/hosted-sqlite-dashboard";

export const metadata: Metadata = {
  title: "Hosted SQLite - 1two",
  description: "Upload and host SQLite databases with a query API",
};

export default function HostedSqlitePage() {
  return <HostedSqliteDashboard />;
}

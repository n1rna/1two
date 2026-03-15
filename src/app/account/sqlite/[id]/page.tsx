import { Metadata } from "next";
import { HostedSqliteStudio } from "@/components/account/hosted-sqlite-studio";

export const metadata: Metadata = {
  title: "SQLite Studio - 1two",
  description: "Browse and query your hosted SQLite database",
};

export default function HostedSqliteStudioPage() {
  return <HostedSqliteStudio />;
}

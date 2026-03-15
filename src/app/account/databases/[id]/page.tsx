import { Metadata } from "next";
import { DatabaseStudio } from "@/components/account/database-studio";

export const metadata: Metadata = {
  title: "Database Studio - 1two",
  description: "Explore tables, view schemas, and run SQL queries",
};

export default function DatabaseStudioPage() {
  return <DatabaseStudio />;
}

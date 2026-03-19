import { Metadata } from "next";
import { StorageBrowser } from "@/components/account/storage-browser";

export const metadata: Metadata = {
  title: "Storage Browser - 1tt",
  description: "Browse and manage files in your S3-compatible storage bucket",
};

export default async function StorageBrowserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; }`}</style>
      <StorageBrowser bucketId={id} />
    </>
  );
}

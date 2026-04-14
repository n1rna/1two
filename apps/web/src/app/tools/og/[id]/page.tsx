import { Metadata } from "next";
import { OgCollectionEditor } from "@/components/tools/og-collection-editor";

export const metadata: Metadata = {
  title: "Edit OG Image - 1tt",
  description: "Edit your saved OG image collection",
};

export default async function OgEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OgCollectionEditor collectionId={id} />;
}

import { ToolLayout } from "@/components/layout/tool-layout";
import { LlmsJobDetail } from "@/components/tools/llms-job-detail";
import { LlmsToolbar } from "@/components/tools/llms-history-popover";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "llms.txt Result",
  description: "View your generated llms.txt file.",
};

interface Props {
  params: Promise<{ jobId: string }>;
}

export default async function LlmsJobPage({ params }: Props) {
  const { jobId } = await params;
  return (
    <ToolLayout slug="llms-txt" toolbar={<LlmsToolbar />}>
      <LlmsJobDetail jobId={jobId} />
    </ToolLayout>
  );
}

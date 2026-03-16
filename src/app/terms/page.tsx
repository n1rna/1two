import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of use for 1tt.dev developer tools.",
};

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-6">Terms of Use</h1>
      <div className="prose prose-sm dark:prose-invert text-muted-foreground space-y-4">
        <p>
          By using 1tt.dev, you agree to these terms. All tools are provided
          &quot;as is&quot; without warranties of any kind.
        </p>
        <p>
          All processing happens in your browser. We do not store, transmit, or
          have access to any data you input into the tools.
        </p>
        <p>
          You may use these tools for personal and commercial purposes. You may
          not attempt to reverse-engineer, redistribute, or resell the tools.
        </p>
        <p>
          We reserve the right to modify or discontinue any tool at any time
          without notice.
        </p>
      </div>
    </div>
  );
}

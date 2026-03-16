import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for 1tt.dev developer tools.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>
      <div className="prose prose-sm dark:prose-invert text-muted-foreground space-y-4">
        <p>
          1tt.dev is designed with privacy in mind. All tools run entirely in
          your browser - no data is sent to any server.
        </p>
        <h2 className="text-lg font-semibold text-foreground">Data Collection</h2>
        <p>
          We do not collect, store, or process any personal data or tool inputs.
          Your data never leaves your browser.
        </p>
        <h2 className="text-lg font-semibold text-foreground">Cookies</h2>
        <p>
          We use a single local storage entry to remember your theme preference
          (light or dark mode). No tracking cookies are used.
        </p>
        <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
        <p>
          We may use privacy-respecting analytics to understand page visits. No
          personally identifiable information is collected.
        </p>
        <h2 className="text-lg font-semibold text-foreground">Contact</h2>
        <p>
          If you have questions about this policy, please open an issue on our
          GitHub repository.
        </p>
      </div>
    </div>
  );
}

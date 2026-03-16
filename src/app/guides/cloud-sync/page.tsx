import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "cloud-sync";

export const metadata = guideMetadata({
  slug,
  title: "Cloud Sync Across Devices",
  description:
    "Keep your tool state, saved connections, and preferences in sync across browsers and devices with one-click cloud sync.",
  keywords: [
    "cloud sync",
    "sync state",
    "cross device",
    "backup",
    "localStorage sync",
    "developer tools sync",
  ],
});

export default function CloudSyncGuide() {
  const jsonLd = guideJsonLd(slug);
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <GuideLayout slug={slug}>
        <Guide.H2>How it works</Guide.H2>
        <Guide.P>
          Every tool on 1tt.dev stores its state in{" "}
          <Guide.Code>localStorage</Guide.Code> by default — connections, saved templates,
          color palettes, bookmarks, and more. This works great on a single device but
          doesn&apos;t follow you to a different browser or machine.
        </Guide.P>
        <Guide.P>
          <Guide.Strong>Cloud sync</Guide.Strong> adds a second layer: when enabled, every
          state change is debounced and pushed to the 1tt.dev backend. When you open the
          same tool on another device, the latest state is pulled down automatically.
        </Guide.P>

        <Guide.H2>Enabling sync</Guide.H2>
        <Guide.Step n={1}>
          <Guide.P>
            Sign in to your 1tt.dev account. Cloud sync requires authentication so we
            know where to store your data.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={2}>
          <Guide.P>
            In any tool that supports sync, find the <Guide.Strong>sync toggle</Guide.Strong>{" "}
            — usually in the toolbar or sidebar. Switch it from{" "}
            <Guide.Code>Local</Guide.Code> to <Guide.Code>Cloud</Guide.Code>.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={3}>
          <Guide.P>
            Your existing local data is pushed to the cloud immediately. From now on,
            changes sync automatically in the background.
          </Guide.P>
        </Guide.Step>

        <Guide.H2>What gets synced</Guide.H2>
        <Guide.P>
          Each tool has specific state keys that are syncable. Here are some examples:
        </Guide.P>
        <Guide.UL>
          <li><Guide.Strong>Elasticsearch Explorer</Guide.Strong> — saved connections and explorer state (open tabs, active connection, queries)</li>
          <li><Guide.Strong>OG Image Builder</Guide.Strong> — custom layouts and saved designs</li>
          <li><Guide.Strong>Color Tools</Guide.Strong> — saved colors and themes</li>
          <li><Guide.Strong>Invoice Creator</Guide.Strong> — saved invoice templates</li>
          <li><Guide.Strong>Calendar</Guide.Strong> — calendar markers</li>
          <li><Guide.Strong>Bookmarks</Guide.Strong> — your bookmarked tools and tool order</li>
        </Guide.UL>

        <Guide.H2>Privacy and storage</Guide.H2>
        <Guide.P>
          Synced data is stored on 1tt.dev&apos;s infrastructure and tied to your account.
          Each syncable key has a size limit (typically 32–256 KB) to keep things
          lightweight. No tool state is shared with other users.
        </Guide.P>
        <Guide.P>
          You can switch back to <Guide.Code>Local</Guide.Code> mode at any time. Your
          cloud data is preserved but no longer updated — the tool reverts to using
          <Guide.Code>localStorage</Guide.Code> only.
        </Guide.P>

        <Guide.H2>Conflict resolution</Guide.H2>
        <Guide.P>
          When you open a tool with cloud sync enabled, the most recent version wins. If
          you made changes offline, they are pushed when you come back online. In rare
          cases where both local and cloud have diverged, the most recently updated
          version takes precedence.
        </Guide.P>
      </GuideLayout>
    </>
  );
}

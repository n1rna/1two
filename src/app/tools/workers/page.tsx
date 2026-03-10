import { WorkerInspector } from "@/components/tools/worker-inspector";
import { ToolInfo } from "@/components/layout/tool-info";
import { toolMetadata, toolJsonLd } from "@/lib/tools/seo";

export const metadata = toolMetadata({
  slug: "workers",
  title: "Service Worker & Cache Inspector",
  description:
    "Inspect registered service workers, view their state, scope, and script URL. Browse Cache Storage entries. Unregister workers and delete caches directly from the browser.",
  keywords: [
    "service worker inspector",
    "service worker",
    "cache storage",
    "web worker",
    "unregister service worker",
    "cache api",
    "pwa debug",
    "sw inspector",
    "browser worker",
    "worker state",
  ],
});

export default function WorkersPage() {
  const jsonLd = toolJsonLd("workers");
  return (
    <>
      {jsonLd?.map((item, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
      <WorkerInspector />
      <div className="max-w-6xl mx-auto px-6 pb-6">
        <ToolInfo>
          <ToolInfo.H2>What are service workers?</ToolInfo.H2>
          <ToolInfo.P>
            Service workers are JavaScript scripts that run in the background, separate from the web page. They intercept network requests, manage caching, and enable offline functionality. They are the foundation of Progressive Web Apps (PWAs) and are registered per origin and scope.
          </ToolInfo.P>

          <ToolInfo.H2>How it works</ToolInfo.H2>
          <ToolInfo.P>
            A service worker goes through a lifecycle: <ToolInfo.Code>installing</ToolInfo.Code> → <ToolInfo.Code>waiting</ToolInfo.Code> → <ToolInfo.Code>active</ToolInfo.Code>. Once active, it controls all pages within its scope. The Cache Storage API lets workers store request/response pairs for offline access. This tool reads from <ToolInfo.Code>navigator.serviceWorker</ToolInfo.Code> and the <ToolInfo.Code>CacheStorage</ToolInfo.Code> API to display registered workers and cached resources.
          </ToolInfo.P>

          <ToolInfo.H2>How to use this tool</ToolInfo.H2>
          <ToolInfo.UL>
            <li>View all <ToolInfo.Strong>registered service workers</ToolInfo.Strong> for the current origin with their state and scope</li>
            <li>Browse <ToolInfo.Strong>Cache Storage</ToolInfo.Strong> entries and inspect cached URLs</li>
            <li><ToolInfo.Strong>Unregister</ToolInfo.Strong> workers or <ToolInfo.Strong>delete caches</ToolInfo.Strong> directly from the browser</li>
          </ToolInfo.UL>

          <ToolInfo.H2>Common use cases</ToolInfo.H2>
          <ToolInfo.UL>
            <li>Debugging PWA caching issues and stale content</li>
            <li>Checking which service worker version is active after a deployment</li>
            <li>Clearing cached assets when testing new builds</li>
            <li>Verifying service worker scope and registration status</li>
          </ToolInfo.UL>
        </ToolInfo>
      </div>
    </>
  );
}

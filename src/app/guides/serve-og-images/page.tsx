import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "serve-og-images";

export const metadata = guideMetadata({
  slug,
  title: "Serve OG Images from 1two.dev",
  description:
    "Design Open Graph images in the browser and serve them directly from a permanent URL — no hosting or build step required.",
  keywords: [
    "og image",
    "open graph",
    "social preview",
    "og image hosting",
    "twitter card image",
    "dynamic og images",
  ],
});

export default function ServeOgImagesGuide() {
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
        <Guide.H2>The problem</Guide.H2>
        <Guide.P>
          Every time you share a link on Twitter, Slack, or LinkedIn, the platform fetches
          an <Guide.Code>og:image</Guide.Code> URL from your page&apos;s meta tags. If that
          image is missing or broken, your link shows up as a plain text snippet that nobody
          clicks.
        </Guide.P>
        <Guide.P>
          Most teams either skip OG images entirely, hand-craft them in Figma, or set up a
          serverless function that renders HTML to PNG on the fly. All of these have trade-offs:
          manual work, cold starts, or infrastructure you have to maintain.
        </Guide.P>

        <Guide.H2>How 1two.dev solves this</Guide.H2>
        <Guide.P>
          The <Guide.Strong>OG Image Builder</Guide.Strong> lets you design your image
          visually in the browser — pick a layout, set your title and subtitle, choose
          colors and fonts — and then gives you a <Guide.Strong>permanent URL</Guide.Strong>{" "}
          that serves the image directly. No build step, no deploy, no hosting to manage.
        </Guide.P>

        <Guide.H3>How the URL works</Guide.H3>
        <Guide.P>
          When you save a design, 1two.dev creates a collection with a unique slug. The
          image is served from a URL like:
        </Guide.P>
        <Guide.Callout>
          <Guide.Code>
            https://1two.dev/og/s/your-collection/open-graph.png?subtitle=Your+Page+Title
          </Guide.Code>
        </Guide.Callout>
        <Guide.P>
          The <Guide.Code>subtitle</Guide.Code> query parameter lets you reuse the same
          design across multiple pages — your blog posts, docs pages, or landing pages can
          all share one base design with a different title per page.
        </Guide.P>

        <Guide.H2>Step by step</Guide.H2>
        <Guide.Step n={1}>
          <Guide.P>
            Open the <Guide.Strong>OG Image Builder</Guide.Strong> and pick a layout.
            There are presets for standard Open Graph (1200x630), Twitter cards, and
            custom sizes.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={2}>
          <Guide.P>
            Customize the design — set your brand name, background color or gradient,
            font, and logo. The preview updates in real time.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={3}>
          <Guide.P>
            Save your design to get a collection URL. You can also export the image as
            PNG for one-off use.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={4}>
          <Guide.P>
            Add the URL to your page&apos;s <Guide.Code>&lt;meta&gt;</Guide.Code> tags. In
            Next.js, that looks like:
          </Guide.P>
        </Guide.Step>
        <Guide.Callout>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre">
{`// app/blog/[slug]/page.tsx
export function generateMetadata({ params }) {
  const title = encodeURIComponent(params.slug);
  return {
    openGraph: {
      images: [\`https://1two.dev/og/s/YOUR_SLUG/open-graph.png?subtitle=\${title}\`],
    },
  };
}`}
          </pre>
        </Guide.Callout>

        <Guide.H2>Checking your images</Guide.H2>
        <Guide.P>
          After deploying, use the <Guide.Strong>OG Image Checker</Guide.Strong> to
          verify everything works. Paste any URL and it fetches the page&apos;s meta tags,
          shows the resolved <Guide.Code>og:image</Guide.Code>, and flags common issues
          like missing dimensions or wrong aspect ratios.
        </Guide.P>

        <Guide.H2>Custom layouts</Guide.H2>
        <Guide.P>
          Beyond the built-in presets, the OG builder supports custom layouts that you can
          save and reuse. Layouts are stored in your browser (and optionally synced to the
          cloud) so they&apos;re available whenever you come back.
        </Guide.P>
        <Guide.P>
          If you need more control — like pulling in dynamic data or rendering complex
          HTML — the image URLs also support additional query parameters for overriding
          colors, fonts, and layout options at request time.
        </Guide.P>
      </GuideLayout>
    </>
  );
}

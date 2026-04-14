import { GuideLayout } from "@/components/layout/guide-layout";
import { Guide } from "@/components/layout/guide-content";
import { guideMetadata, guideJsonLd } from "@/lib/guides/seo";

const slug = "config-generators";

export const metadata = guideMetadata({
  slug,
  title: "Generate Config Files Instantly",
  description:
    "Interactive config generators for TypeScript, ESLint, Prettier, Docker, nginx, and more - pick options and copy the result.",
  keywords: [
    "config generator",
    "tsconfig generator",
    "eslint config",
    "prettier config",
    "dockerfile generator",
    "nginx config",
    "gitignore generator",
  ],
});

export default function ConfigGeneratorsGuide() {
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
        <Guide.H2>Why config generators</Guide.H2>
        <Guide.P>
          Config files are one of the most copy-pasted artifacts in software development.
          You know the drill: open a docs page, scroll past the explanations, find the
          example, paste it, then tweak the parts you need. The{" "}
          <Guide.Strong>Config Generator</Guide.Strong> on 1tt.dev skips the docs and
          gives you an interactive form instead.
        </Guide.P>

        <Guide.H2>Supported configs</Guide.H2>
        <Guide.P>
          The tool currently supports 13 config types across different ecosystems:
        </Guide.P>
        <Guide.UL>
          <li><Guide.Strong>TypeScript</Guide.Strong> - <Guide.Code>tsconfig.json</Guide.Code> with target, module, strict mode, path aliases, and more</li>
          <li><Guide.Strong>ESLint</Guide.Strong> - flat config format with parser, plugin, and rule presets</li>
          <li><Guide.Strong>Prettier</Guide.Strong> - formatting options like print width, tabs vs spaces, trailing commas</li>
          <li><Guide.Strong>Docker</Guide.Strong> - multi-stage Dockerfiles with base image, build steps, and runtime config</li>
          <li><Guide.Strong>nginx</Guide.Strong> - server blocks, reverse proxy, SSL, and caching directives</li>
          <li><Guide.Strong>.gitignore</Guide.Strong> - pre-built templates for Node, Python, Go, Rust, and more</li>
          <li><Guide.Strong>.editorconfig</Guide.Strong> - indent style, charset, and end-of-line settings</li>
          <li>And more: <Guide.Code>.env</Guide.Code>, <Guide.Code>docker-compose.yml</Guide.Code>, GitHub Actions, Tailwind CSS, Vite</li>
        </Guide.UL>

        <Guide.H2>How to use it</Guide.H2>
        <Guide.Step n={1}>
          <Guide.P>
            Pick a config type from the sidebar. Each one shows a form with the relevant
            options for that tool.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={2}>
          <Guide.P>
            Toggle options, fill in values, and watch the preview update in real time. The
            generated output is always valid and ready to use.
          </Guide.P>
        </Guide.Step>
        <Guide.Step n={3}>
          <Guide.P>
            Copy the result to your clipboard or download it as a file. The filename is
            pre-set to the conventional name (e.g.,{" "}
            <Guide.Code>tsconfig.json</Guide.Code>,{" "}
            <Guide.Code>.prettierrc</Guide.Code>).
          </Guide.P>
        </Guide.Step>
      </GuideLayout>
    </>
  );
}

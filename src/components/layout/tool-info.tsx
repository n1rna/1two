import { ReactNode } from "react";

/**
 * ToolInfo — SEO-friendly explanation section for tool pages.
 *
 * Renders a divider followed by a prose section with consistent styling.
 * Pass children as JSX using the helper components for consistent formatting.
 *
 * ## How to write good tool info content
 *
 * Structure your content with these sections (in order):
 *
 * 1. **What is [X]?** — A concise definition of the concept (1–2 paragraphs).
 *    Mention the full name, abbreviation, and where it's commonly used.
 *
 * 2. **How it works** — A brief technical explanation accessible to developers.
 *    Explain the core mechanism without going too deep. Use `<Code>` for
 *    technical terms, values, and format names.
 *
 * 3. **How to use this tool** — Bullet points describing the tool's features.
 *    Focus on what the user can *do*, not how the UI looks. Use `<Strong>`
 *    to highlight key actions.
 *
 * 4. **Common use cases** — Bullet points with real-world examples.
 *    Be specific (e.g., "HTTP Basic auth headers" not "authentication").
 *    Use `<Code>` for any code-like values.
 *
 * ### Style guidelines
 * - Keep it concise — aim for scannability, not essays
 * - Use `<Code>` for: encoding names, header values, file extensions,
 *   character sets, CLI commands, format names
 * - Use `<Strong>` for: feature names, key concepts, action words
 * - Use `<H2>` for section headings, `<P>` for paragraphs, `<UL>` for lists
 * - Write in third person or imperative ("Type or paste..." not "You can type...")
 * - No marketing language — be direct and technical
 *
 * @example
 * ```tsx
 * <ToolInfo>
 *   <ToolInfo.H2>What is Base64?</ToolInfo.H2>
 *   <ToolInfo.P>
 *     Base64 is a binary-to-text encoding using
 *     <ToolInfo.Code>A–Z</ToolInfo.Code>, <ToolInfo.Code>a–z</ToolInfo.Code>,
 *     <ToolInfo.Code>0–9</ToolInfo.Code>, and two symbols.
 *   </ToolInfo.P>
 *   <ToolInfo.H2>Common use cases</ToolInfo.H2>
 *   <ToolInfo.UL>
 *     <li>Embedding images as <ToolInfo.Code>data:</ToolInfo.Code> URIs</li>
 *   </ToolInfo.UL>
 * </ToolInfo>
 * ```
 */
export function ToolInfo({ children }: { children: ReactNode }) {
  return (
    <>
      <hr className="my-12 border-border/50" />
      <section className="max-w-2xl space-y-6 text-sm text-muted-foreground leading-relaxed">
        {children}
      </section>
    </>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-semibold text-foreground">{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc list-inside space-y-1.5">{children}</ul>;
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="text-foreground bg-muted px-1 py-0.5 rounded text-xs">
      {children}
    </code>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-foreground">{children}</strong>;
}

ToolInfo.H2 = H2;
ToolInfo.P = P;
ToolInfo.UL = UL;
ToolInfo.Code = Code;
ToolInfo.Strong = Strong;

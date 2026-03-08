import { ToolDefinition, ToolCategory, categoryLabels } from "./types";

export const tools: ToolDefinition[] = [
  {
    slug: "jwt",
    name: "JWT Parser",
    description: "Decode and inspect JWT tokens — view header, payload, and verify signatures",
    category: "parsing",
    icon: "KeyRound",
    keywords: ["jwt", "token", "decode", "json web token", "auth", "bearer"],
  },
  {
    slug: "json",
    name: "JSON Tool",
    description: "Validate, auto-correct, format, and explore JSON with an interactive tree viewer",
    category: "formatting",
    icon: "Braces",
    keywords: ["json", "format", "beautify", "minify", "validate", "tree", "parse", "fix"],
  },
  {
    slug: "b64",
    name: "Base64 Encoder/Decoder",
    description: "Encode and decode Base64 strings with support for URL-safe encoding",
    category: "encoding",
    icon: "Binary",
    keywords: ["base64", "encode", "decode", "binary", "data uri"],
  },
  {
    slug: "diff",
    name: "Diff Tool",
    description: "Compare two or more texts side by side with line-by-line diff highlighting",
    category: "text",
    icon: "GitCompareArrows",
    keywords: ["diff", "compare", "merge", "text", "difference", "side by side"],
  },
  {
    slug: "cron",
    name: "Cron Builder",
    description: "Build, visualize, and understand cron schedule expressions",
    category: "generators",
    icon: "Clock",
    keywords: ["cron", "crontab", "schedule", "timer", "job", "recurring", "interval"],
  },
  {
    slug: "timestamp",
    name: "Timestamp Tool",
    description: "Parse and convert Unix timestamps, ISO 8601 / RFC 3339, and RFC 2822 datetime formats",
    category: "conversion",
    icon: "Clock3",
    keywords: ["timestamp", "unix", "epoch", "iso", "rfc3339", "rfc2822", "datetime", "time", "date", "timezone", "utc", "convert"],
  },
  {
    slug: "color",
    name: "Color Tool",
    description: "Build themes with CSS variable tokens, preset themes, live dashboard preview, and color builder",
    category: "web",
    icon: "Palette",
    keywords: ["color", "colour", "picker", "palette", "hex", "rgb", "hsl", "oklch", "theme", "tokens", "css variables", "preset"],
  },
  {
    slug: "random",
    name: "Random Generator",
    description: "Generate UUIDs, passwords, secret keys, hex strings, and random numbers",
    category: "generators",
    icon: "Dices",
    keywords: ["random", "uuid", "password", "secret", "hex", "generate", "key", "token", "number", "lorem", "ipsum", "text"],
  },
  {
    slug: "keyboard",
    name: "Keyboard Tester",
    description: "Test your keyboard with a visual key tester supporting multiple layouts and sizes",
    category: "web",
    icon: "Keyboard",
    keywords: ["keyboard", "key", "test", "tester", "layout", "qwerty", "azerty", "dvorak", "colemak", "60", "tkl", "split"],
  },
  {
    slug: "microphone",
    name: "Microphone Test",
    description: "Test your microphone, view audio levels and device info, and record clips",
    category: "web",
    icon: "Mic",
    keywords: ["microphone", "mic", "audio", "test", "record", "sound", "level", "spectrum"],
  },
  {
    slug: "webcam",
    name: "Webcam Test",
    description: "Test your webcam, view resolution and device info, and capture frames",
    category: "web",
    icon: "Camera",
    keywords: ["webcam", "camera", "video", "test", "capture", "screenshot", "resolution"],
  },
  {
    slug: "markdown",
    name: "Markdown Editor",
    description: "Write and preview markdown with toolbar shortcuts and live rendering",
    category: "text",
    icon: "FileText",
    keywords: ["markdown", "md", "editor", "preview", "write", "format", "text"],
  },
];

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return tools.find((t) => t.slug === slug);
}

export function getToolsByCategory(): Record<ToolCategory, ToolDefinition[]> {
  const grouped = {} as Record<ToolCategory, ToolDefinition[]>;
  for (const tool of tools) {
    if (!grouped[tool.category]) {
      grouped[tool.category] = [];
    }
    grouped[tool.category].push(tool);
  }
  return grouped;
}

export function searchTools(query: string): ToolDefinition[] {
  const q = query.toLowerCase();
  return tools.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.includes(q))
  );
}

export { categoryLabels };
export type { ToolDefinition, ToolCategory };

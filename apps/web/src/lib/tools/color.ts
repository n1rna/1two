// ── Types ──────────────────────────────────────────────

export interface HSVA {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
  a: number; // 0-1
}

export interface RGBA {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

export interface HSLA {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
  a: number; // 0-1
}

export interface OKLCH {
  l: number; // 0-1
  c: number; // 0-~0.4
  h: number; // 0-360
}

export interface SavedColor {
  id: string;
  hsva: HSVA;
  name: string;
}

// ── Theme Token System ────────────────────────────────

export const THEME_TOKEN_KEYS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
] as const;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
export type ThemeTokens = Record<ThemeTokenKey, string>;

export const THEME_TOKEN_META: { key: ThemeTokenKey; label: string; group: string }[] = [
  { key: "background", label: "Background", group: "Base" },
  { key: "foreground", label: "Foreground", group: "Base" },
  { key: "card", label: "Card", group: "Surface" },
  { key: "card-foreground", label: "Card Text", group: "Surface" },
  { key: "primary", label: "Primary", group: "Brand" },
  { key: "primary-foreground", label: "Primary Text", group: "Brand" },
  { key: "secondary", label: "Secondary", group: "Brand" },
  { key: "secondary-foreground", label: "Secondary Text", group: "Brand" },
  { key: "muted", label: "Muted", group: "Neutral" },
  { key: "muted-foreground", label: "Muted Text", group: "Neutral" },
  { key: "accent", label: "Accent", group: "Brand" },
  { key: "accent-foreground", label: "Accent Text", group: "Brand" },
  { key: "destructive", label: "Destructive", group: "Status" },
  { key: "destructive-foreground", label: "Destructive Text", group: "Status" },
  { key: "border", label: "Border", group: "Neutral" },
  { key: "input", label: "Input", group: "Neutral" },
  { key: "ring", label: "Ring", group: "Neutral" },
];

export interface ThemePreset {
  id: string;
  label: string;
  light: ThemeTokens;
  dark: ThemeTokens;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "modern-minimal",
    label: "Modern Minimal",
    light: {
      "background": "#ffffff", "foreground": "#333333",
      "card": "#ffffff", "card-foreground": "#333333",
      "primary": "#3b82f6", "primary-foreground": "#ffffff",
      "secondary": "#f3f4f6", "secondary-foreground": "#4b5563",
      "muted": "#f9fafb", "muted-foreground": "#6b7280",
      "accent": "#e0f2fe", "accent-foreground": "#1e3a8a",
      "destructive": "#ef4444", "destructive-foreground": "#ffffff",
      "border": "#e5e7eb", "input": "#e5e7eb", "ring": "#3b82f6",
    },
    dark: {
      "background": "#171717", "foreground": "#e5e5e5",
      "card": "#262626", "card-foreground": "#e5e5e5",
      "primary": "#3b82f6", "primary-foreground": "#ffffff",
      "secondary": "#262626", "secondary-foreground": "#e5e5e5",
      "muted": "#1f1f1f", "muted-foreground": "#a3a3a3",
      "accent": "#1e3a8a", "accent-foreground": "#bfdbfe",
      "destructive": "#ef4444", "destructive-foreground": "#ffffff",
      "border": "#404040", "input": "#404040", "ring": "#3b82f6",
    },
  },
  {
    id: "violet-bloom",
    label: "Violet Bloom",
    light: {
      "background": "#fdfdfd", "foreground": "#000000",
      "card": "#fdfdfd", "card-foreground": "#000000",
      "primary": "#7033ff", "primary-foreground": "#ffffff",
      "secondary": "#edf0f4", "secondary-foreground": "#080808",
      "muted": "#f5f5f5", "muted-foreground": "#525252",
      "accent": "#e2ebff", "accent-foreground": "#1e69dc",
      "destructive": "#e54b4f", "destructive-foreground": "#ffffff",
      "border": "#e7e7ee", "input": "#ebebeb", "ring": "#000000",
    },
    dark: {
      "background": "#1a1b1e", "foreground": "#f0f0f0",
      "card": "#222327", "card-foreground": "#f0f0f0",
      "primary": "#8c5cff", "primary-foreground": "#ffffff",
      "secondary": "#2a2c33", "secondary-foreground": "#f0f0f0",
      "muted": "#2a2c33", "muted-foreground": "#a0a0a0",
      "accent": "#1e293b", "accent-foreground": "#79c0ff",
      "destructive": "#f87171", "destructive-foreground": "#ffffff",
      "border": "#33353a", "input": "#33353a", "ring": "#8c5cff",
    },
  },
  {
    id: "ocean-breeze",
    label: "Ocean Breeze",
    light: {
      "background": "#f0f8ff", "foreground": "#374151",
      "card": "#ffffff", "card-foreground": "#374151",
      "primary": "#22c55e", "primary-foreground": "#ffffff",
      "secondary": "#e0f2fe", "secondary-foreground": "#4b5563",
      "muted": "#f3f4f6", "muted-foreground": "#6b7280",
      "accent": "#d1fae5", "accent-foreground": "#374151",
      "destructive": "#ef4444", "destructive-foreground": "#ffffff",
      "border": "#e5e7eb", "input": "#e5e7eb", "ring": "#22c55e",
    },
    dark: {
      "background": "#0f172a", "foreground": "#d1d5db",
      "card": "#1e293b", "card-foreground": "#d1d5db",
      "primary": "#34d399", "primary-foreground": "#0f172a",
      "secondary": "#2d3748", "secondary-foreground": "#a1a1aa",
      "muted": "#19212e", "muted-foreground": "#6b7280",
      "accent": "#374151", "accent-foreground": "#a1a1aa",
      "destructive": "#ef4444", "destructive-foreground": "#0f172a",
      "border": "#4b5563", "input": "#4b5563", "ring": "#34d399",
    },
  },
  {
    id: "bold-tech",
    label: "Bold Tech",
    light: {
      "background": "#ffffff", "foreground": "#312e81",
      "card": "#ffffff", "card-foreground": "#312e81",
      "primary": "#8b5cf6", "primary-foreground": "#ffffff",
      "secondary": "#f3f0ff", "secondary-foreground": "#4338ca",
      "muted": "#f5f3ff", "muted-foreground": "#7c3aed",
      "accent": "#dbeafe", "accent-foreground": "#1e40af",
      "destructive": "#ef4444", "destructive-foreground": "#ffffff",
      "border": "#e0e7ff", "input": "#e0e7ff", "ring": "#8b5cf6",
    },
    dark: {
      "background": "#0f172a", "foreground": "#e0e7ff",
      "card": "#1e1b4b", "card-foreground": "#e0e7ff",
      "primary": "#8b5cf6", "primary-foreground": "#ffffff",
      "secondary": "#1e1b4b", "secondary-foreground": "#e0e7ff",
      "muted": "#171447", "muted-foreground": "#c4b5fd",
      "accent": "#4338ca", "accent-foreground": "#e0e7ff",
      "destructive": "#ef4444", "destructive-foreground": "#ffffff",
      "border": "#2e1065", "input": "#2e1065", "ring": "#8b5cf6",
    },
  },
  {
    id: "sage-garden",
    label: "Sage Garden",
    light: {
      "background": "#f8f7f4", "foreground": "#1a1f2e",
      "card": "#ffffff", "card-foreground": "#1a1f2e",
      "primary": "#7c9082", "primary-foreground": "#ffffff",
      "secondary": "#ced4bf", "secondary-foreground": "#1a1f2e",
      "muted": "#e8e6e1", "muted-foreground": "#6b7280",
      "accent": "#bfc9bb", "accent-foreground": "#1a1f2e",
      "destructive": "#c73e3a", "destructive-foreground": "#ffffff",
      "border": "#e8e6e1", "input": "#ffffff", "ring": "#7c9082",
    },
    dark: {
      "background": "#0a0a0a", "foreground": "#f5f5f5",
      "card": "#121212", "card-foreground": "#f5f5f5",
      "primary": "#7c9082", "primary-foreground": "#000000",
      "secondary": "#1a1a1a", "secondary-foreground": "#f5f5f5",
      "muted": "#1a1a1a", "muted-foreground": "#a0a0a0",
      "accent": "#36443a", "accent-foreground": "#f5f5f5",
      "destructive": "#ef4444", "destructive-foreground": "#ffffff",
      "border": "#2a2a2a", "input": "#121212", "ring": "#7c9082",
    },
  },
  {
    id: "clean-slate",
    label: "Clean Slate",
    light: {
      "background": "#f8fafc", "foreground": "#1e293b",
      "card": "#ffffff", "card-foreground": "#1e293b",
      "primary": "#6366f1", "primary-foreground": "#ffffff",
      "secondary": "#e5e7eb", "secondary-foreground": "#374151",
      "muted": "#f3f4f6", "muted-foreground": "#6b7280",
      "accent": "#e0e7ff", "accent-foreground": "#374151",
      "destructive": "#ef4444", "destructive-foreground": "#ffffff",
      "border": "#d1d5db", "input": "#d1d5db", "ring": "#6366f1",
    },
    dark: {
      "background": "#0f172a", "foreground": "#e2e8f0",
      "card": "#1e293b", "card-foreground": "#e2e8f0",
      "primary": "#818cf8", "primary-foreground": "#0f172a",
      "secondary": "#2d3748", "secondary-foreground": "#d1d5db",
      "muted": "#152032", "muted-foreground": "#9ca3af",
      "accent": "#374151", "accent-foreground": "#d1d5db",
      "destructive": "#ef4444", "destructive-foreground": "#0f172a",
      "border": "#4b5563", "input": "#4b5563", "ring": "#818cf8",
    },
  },
  {
    id: "sunset-horizon",
    label: "Sunset Horizon",
    light: {
      "background": "#fff9f5", "foreground": "#3d3436",
      "card": "#ffffff", "card-foreground": "#3d3436",
      "primary": "#ff7e5f", "primary-foreground": "#ffffff",
      "secondary": "#ffedea", "secondary-foreground": "#b35340",
      "muted": "#fff0eb", "muted-foreground": "#78716c",
      "accent": "#feb47b", "accent-foreground": "#3d3436",
      "destructive": "#e63946", "destructive-foreground": "#ffffff",
      "border": "#ffe0d6", "input": "#ffe0d6", "ring": "#ff7e5f",
    },
    dark: {
      "background": "#2a2024", "foreground": "#f2e9e4",
      "card": "#392f35", "card-foreground": "#f2e9e4",
      "primary": "#ff7e5f", "primary-foreground": "#ffffff",
      "secondary": "#463a41", "secondary-foreground": "#f2e9e4",
      "muted": "#30272c", "muted-foreground": "#d7c6bc",
      "accent": "#feb47b", "accent-foreground": "#2a2024",
      "destructive": "#e63946", "destructive-foreground": "#ffffff",
      "border": "#463a41", "input": "#463a41", "ring": "#ff7e5f",
    },
  },
  {
    id: "midnight-bloom",
    label: "Midnight Bloom",
    light: {
      "background": "#f9f9f9", "foreground": "#333333",
      "card": "#ffffff", "card-foreground": "#333333",
      "primary": "#6c5ce7", "primary-foreground": "#ffffff",
      "secondary": "#a1c9f2", "secondary-foreground": "#333333",
      "muted": "#c9c4b5", "muted-foreground": "#6e6e6e",
      "accent": "#8b9467", "accent-foreground": "#ffffff",
      "destructive": "#ef4444", "destructive-foreground": "#ffffff",
      "border": "#d4d4d4", "input": "#d4d4d4", "ring": "#6c5ce7",
    },
    dark: {
      "background": "#1a1d23", "foreground": "#e5e5e5",
      "card": "#2f3436", "card-foreground": "#e5e5e5",
      "primary": "#6c5ce7", "primary-foreground": "#ffffff",
      "secondary": "#4b0082", "secondary-foreground": "#e5e5e5",
      "muted": "#444444", "muted-foreground": "#a3a3a3",
      "accent": "#6495ed", "accent-foreground": "#e5e5e5",
      "destructive": "#ef4444", "destructive-foreground": "#ffffff",
      "border": "#444444", "input": "#444444", "ring": "#6c5ce7",
    },
  },
];

// Core tokens the user directly picks - the rest are derived
export const CORE_TOKENS: ThemeTokenKey[] = [
  "primary", "secondary", "accent", "destructive",
];

export type HarmonyType =
  | "complementary"
  | "analogous"
  | "triadic"
  | "split-complementary"
  | "monochromatic";

export const HARMONY_TYPES: { value: HarmonyType; label: string }[] = [
  { value: "analogous", label: "Analogous" },
  { value: "complementary", label: "Complementary" },
  { value: "triadic", label: "Triadic" },
  { value: "split-complementary", label: "Split Comp." },
  { value: "monochromatic", label: "Monochromatic" },
];

// Generate a full theme from a primary hex color
export function generateThemeTokens(
  primaryHex: string,
  mode: "light" | "dark",
  harmony: HarmonyType = "analogous"
): ThemeTokens {
  const pRgba = parseHex(primaryHex) || { r: 59, g: 130, b: 246, a: 1 };
  const pHsva = rgbaToHsva(pRgba);
  const h = pHsva.h;

  // Generate secondary and accent hues based on harmony
  let secHue: number;
  let accHue: number;
  switch (harmony) {
    case "complementary":
      secHue = (h + 180) % 360;
      accHue = (h + 210) % 360;
      break;
    case "triadic":
      secHue = (h + 120) % 360;
      accHue = (h + 240) % 360;
      break;
    case "split-complementary":
      secHue = (h + 150) % 360;
      accHue = (h + 210) % 360;
      break;
    case "monochromatic":
      secHue = h;
      accHue = h;
      break;
    case "analogous":
    default:
      secHue = (h + 30) % 360;
      accHue = (h + 60) % 360;
      break;
  }

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  const hslToHex = (hue: number, sat: number, lit: number): string => {
    const hsla: HSLA = { h: hue, s: Math.max(0, Math.min(1, sat)), l: Math.max(0, Math.min(1, lit)), a: 1 };
    const hsva = hslaToHsva(hsla);
    const rgba = hsvaToRgba(hsva);
    return `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;
  };

  // Add slight random variation so each generate looks different
  const jit = (v: number, range: number = 0.04) =>
    v + (Math.random() - 0.5) * range;

  const primaryFg = contrastTextHex(primaryHex);

  if (mode === "light") {
    const secSat = jit(0.80, 0.15);
    const secLit = jit(0.94, 0.03);
    const accSat = jit(0.85, 0.12);
    const accLit = jit(0.92, 0.04);
    const secondary = hslToHex(secHue, secSat, secLit);
    const accent = hslToHex(accHue, accSat, accLit);
    return {
      "background": hslToHex(h, jit(0.05, 0.04), jit(0.99, 0.01)),
      "foreground": hslToHex(h, 0.10, 0.15),
      "card": "#ffffff",
      "card-foreground": hslToHex(h, 0.10, 0.15),
      "primary": primaryHex,
      "primary-foreground": primaryFg,
      "secondary": secondary,
      "secondary-foreground": hslToHex(secHue, jit(0.40, 0.10), jit(0.30, 0.06)),
      "muted": hslToHex(h, jit(0.10, 0.06), jit(0.96, 0.02)),
      "muted-foreground": hslToHex(h, 0.06, jit(0.45, 0.05)),
      "accent": accent,
      "accent-foreground": hslToHex(accHue, jit(0.50, 0.15), jit(0.22, 0.06)),
      "destructive": "#ef4444",
      "destructive-foreground": "#ffffff",
      "border": hslToHex(h, jit(0.12, 0.06), jit(0.90, 0.03)),
      "input": hslToHex(h, jit(0.12, 0.06), jit(0.90, 0.03)),
      "ring": primaryHex,
    };
  } else {
    const secSat = jit(0.10, 0.06);
    const secLit = jit(0.15, 0.04);
    const accSat = jit(0.15, 0.08);
    const accLit = jit(0.22, 0.04);
    return {
      "background": hslToHex(h, jit(0.08, 0.04), jit(0.08, 0.02)),
      "foreground": hslToHex(h, 0.05, 0.92),
      "card": hslToHex(h, jit(0.06, 0.03), jit(0.12, 0.02)),
      "card-foreground": hslToHex(h, 0.05, 0.92),
      "primary": primaryHex,
      "primary-foreground": primaryFg,
      "secondary": hslToHex(secHue, secSat, secLit),
      "secondary-foreground": hslToHex(secHue, jit(0.08, 0.04), jit(0.80, 0.05)),
      "muted": hslToHex(h, jit(0.06, 0.03), jit(0.14, 0.02)),
      "muted-foreground": hslToHex(h, 0.04, jit(0.60, 0.05)),
      "accent": hslToHex(accHue, accSat, accLit),
      "accent-foreground": hslToHex(accHue, jit(0.10, 0.04), jit(0.85, 0.05)),
      "destructive": "#ef4444",
      "destructive-foreground": "#ffffff",
      "border": hslToHex(h, jit(0.06, 0.03), jit(0.22, 0.03)),
      "input": hslToHex(h, jit(0.06, 0.03), jit(0.22, 0.03)),
      "ring": primaryHex,
    };
  }
}

export interface SavedTheme {
  id: string;
  name: string;
  tokens: ThemeTokens;
  mode: "light" | "dark";
}

// ── LocalStorage ───────────────────────────────────────

const COLORS_KEY = "1tt-saved-colors";
const THEMES_KEY = "1tt-saved-themes";

export function loadSavedColors(): SavedColor[] {
  try {
    const data = localStorage.getItem(COLORS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSavedColors(colors: SavedColor[]) {
  localStorage.setItem(COLORS_KEY, JSON.stringify(colors));
}

export function loadSavedThemes(): SavedTheme[] {
  try {
    const data = localStorage.getItem(THEMES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveSavedThemes(themes: SavedTheme[]) {
  localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
}

// ── Conversions ────────────────────────────────────────

export function hsvaToRgba(c: HSVA): RGBA {
  const { h, s, v, a } = c;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255), a };
}

export function rgbaToHsva(c: RGBA): HSVA {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s, v, a: c.a };
}

export function hsvaToHsla(c: HSVA): HSLA {
  const l = c.v * (1 - c.s / 2);
  const s = l === 0 || l === 1 ? 0 : (c.v - l) / Math.min(l, 1 - l);
  return { h: c.h, s, l, a: c.a };
}

export function hslaToHsva(c: HSLA): HSVA {
  const v = c.l + c.s * Math.min(c.l, 1 - c.l);
  const s = v === 0 ? 0 : 2 * (1 - c.l / v);
  return { h: c.h, s, v, a: c.a };
}

export function rgbaToOklch(c: RGBA): OKLCH {
  const linearize = (x: number) => {
    const v = x / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lr = linearize(c.r), lg = linearize(c.g), lb = linearize(c.b);

  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l = Math.cbrt(l_), m = Math.cbrt(m_), s = Math.cbrt(s_);

  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;

  const C = Math.sqrt(a * a + b * b);
  let H = Math.atan2(b, a) * (180 / Math.PI);
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

// ── Formatting ─────────────────────────────────────────

export function formatHex(rgba: RGBA): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  const base = `#${hex(rgba.r)}${hex(rgba.g)}${hex(rgba.b)}`;
  if (rgba.a < 1) {
    return `${base}${hex(Math.round(rgba.a * 255))}`;
  }
  return base;
}

export function formatRgb(rgba: RGBA): string {
  if (rgba.a < 1) {
    return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${round(rgba.a, 2)})`;
  }
  return `rgb(${rgba.r}, ${rgba.g}, ${rgba.b})`;
}

export function formatHsl(hsla: HSLA): string {
  const h = Math.round(hsla.h);
  const s = Math.round(hsla.s * 100);
  const l = Math.round(hsla.l * 100);
  if (hsla.a < 1) {
    return `hsla(${h}, ${s}%, ${l}%, ${round(hsla.a, 2)})`;
  }
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function formatOklch(oklch: OKLCH): string {
  return `oklch(${round(oklch.l, 3)} ${round(oklch.c, 3)} ${round(oklch.h, 1)})`;
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// ── Parsing ────────────────────────────────────────────

export function parseHex(hex: string): RGBA | null {
  const m = hex.match(/^#?([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

// ── Quantization ───────────────────────────────────────

export function quantize(value: number, bits: number, max: number = 255): number {
  const levels = Math.pow(2, bits);
  const step = max / (levels - 1);
  return Math.round(Math.round(value / step) * step * 1000) / 1000;
}

export function quantizeRgba(rgba: RGBA, bits: number): RGBA {
  return {
    r: Math.round(quantize(rgba.r, bits)),
    g: Math.round(quantize(rgba.g, bits)),
    b: Math.round(quantize(rgba.b, bits)),
    a: rgba.a,
  };
}

// ── Color Manipulation ─────────────────────────────────

export function adjustLightness(hsva: HSVA, amount: number): HSVA {
  const hsla = hsvaToHsla(hsva);
  hsla.l = Math.max(0, Math.min(1, hsla.l + amount));
  return hslaToHsva(hsla);
}

export function adjustSaturation(hsva: HSVA, amount: number): HSVA {
  return { ...hsva, s: Math.max(0, Math.min(1, hsva.s + amount)) };
}

export function shiftHue(hsva: HSVA, degrees: number): HSVA {
  return { ...hsva, h: (hsva.h + degrees + 360) % 360 };
}

// ── Contrast ──────────────────────────────────────────

export function contrastText(hsva: HSVA): string {
  const { r, g, b } = hsvaToRgba(hsva);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export function contrastTextHex(hex: string): string {
  const rgba = parseHex(hex);
  if (!rgba) return "#000000";
  const luminance = (0.299 * rgba.r + 0.587 * rgba.g + 0.114 * rgba.b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

// ── Canvas Drawing ─────────────────────────────────────

export function drawSVCanvas(
  ctx: CanvasRenderingContext2D,
  hue: number,
  width: number,
  height: number
) {
  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
  ctx.fillRect(0, 0, width, height);

  const white = ctx.createLinearGradient(0, 0, width, 0);
  white.addColorStop(0, "rgba(255,255,255,1)");
  white.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, width, height);

  const black = ctx.createLinearGradient(0, 0, 0, height);
  black.addColorStop(0, "rgba(0,0,0,0)");
  black.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = black;
  ctx.fillRect(0, 0, width, height);
}

// ── CSS Helpers ───────────────────────────────────────

export function hsvaTocss(c: HSVA): string {
  const rgba = hsvaToRgba(c);
  return `rgba(${rgba.r},${rgba.g},${rgba.b},${c.a})`;
}

export function hsvaToSolidCss(c: HSVA): string {
  const rgba = hsvaToRgba(c);
  return `rgb(${rgba.r},${rgba.g},${rgba.b})`;
}

export function themeTokensToCssVars(tokens: ThemeTokens): React.CSSProperties {
  const vars: Record<string, string> = {};
  for (const key of THEME_TOKEN_KEYS) {
    vars[`--${key}`] = tokens[key];
  }
  return vars as React.CSSProperties;
}

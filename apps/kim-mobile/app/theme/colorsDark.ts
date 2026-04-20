// Dark palette mirroring apps/kim/src/app/globals.css .dark.
// Ignite's convention: the same token names mean the same roles across light
// and dark, but the numeric scale is inverted (neutral900 = text, 100 = bg).
const palette = {
  neutral900: "#F3F4F4", // foreground
  neutral800: "#E4E4E7",
  neutral700: "#A1A1AA", // mutedForeground
  neutral600: "#71717A",
  neutral500: "#52525B",
  neutral400: "#3F3F46",
  neutral300: "#26262A", // border
  neutral200: "#141416", // card
  neutral100: "#0A0A0B", // background

  // Primary on dark is the brighter mid teal
  primary100: "#1D546D",
  primary200: "#2F6C84",
  primary300: "#417F95",
  primary400: "#5F9598",
  primary500: "#7AADB0",
  primary600: "#A3C7C9",

  // Secondary on dark flips to the darker sage
  secondary100: "#5F9598",
  secondary200: "#4E8092",
  secondary300: "#3E6A7D",
  secondary400: "#2F586D",
  secondary500: "#1D546D",

  accent100: "#FFBB50",
  accent200: "#FBC878",
  accent300: "#FDD495",
  accent400: "#FFE1B2",
  accent500: "#FFEED4",

  angry100: "#4A1414",
  angry500: "#DC2626",

  overlay20: "rgba(0, 0, 0, 0.2)",
  overlay50: "rgba(0, 0, 0, 0.5)",
} as const

export const colors = {
  palette,
  transparent: "rgba(0, 0, 0, 0)",
  text: palette.neutral900,
  textDim: palette.neutral700,
  background: palette.neutral100,
  border: palette.neutral300,
  tint: palette.primary400,
  tintInactive: palette.neutral400,
  separator: palette.neutral300,
  error: palette.angry500,
  errorBackground: palette.angry100,
} as const

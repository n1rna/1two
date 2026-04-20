// Light palette mirroring apps/kim/src/app/globals.css :root.
const palette = {
  neutral100: "#FFFFFF",
  neutral200: "#FAFAF9", // background
  neutral300: "#E4E4E7", // border
  neutral400: "#D4D4D8",
  neutral500: "#A1A1AA",
  neutral600: "#71717A", // mutedForeground
  neutral700: "#3F3F46",
  neutral800: "#18181B", // foreground
  neutral900: "#0A0A0B",

  // Sage teal (primary) on light is the darker teal
  primary100: "#E6EEF1",
  primary200: "#BFD2DB",
  primary300: "#8FAFBD",
  primary400: "#4E8092",
  primary500: "#1D546D",
  primary600: "#143B4D",

  // Mid teal (accent)
  secondary100: "#E4EEEE",
  secondary200: "#BFD5D6",
  secondary300: "#93B9BA",
  secondary400: "#74A5A7",
  secondary500: "#5F9598",

  // Amber accent kept for highlight states
  accent100: "#FFEED4",
  accent200: "#FFE1B2",
  accent300: "#FDD495",
  accent400: "#FBC878",
  accent500: "#FFBB50",

  angry100: "#FDE2E2",
  angry500: "#DC2626",

  overlay20: "rgba(10, 10, 11, 0.2)",
  overlay50: "rgba(10, 10, 11, 0.5)",
} as const

export const colors = {
  palette,
  transparent: "rgba(0, 0, 0, 0)",
  text: palette.neutral800,
  textDim: palette.neutral600,
  background: palette.neutral200,
  border: palette.neutral300,
  tint: palette.primary500,
  tintInactive: palette.neutral400,
  separator: palette.neutral300,
  error: palette.angry500,
  errorBackground: palette.angry100,
} as const

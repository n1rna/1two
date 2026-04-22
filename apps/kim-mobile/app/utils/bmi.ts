/**
 * BMI helpers shared by the Health hub.
 *
 * BMI categories follow the WHO adult thresholds used on the web:
 *   < 18.5        underweight  (yellow/amber)
 *   18.5 – 24.99  healthy      (green)
 *   25 – 29.99    overweight   (yellow/amber)
 *   >= 30         obese        (red)
 *
 * The color helper is theme-aware so dark mode can swap palettes in later.
 */
import type { Theme } from "@/theme/types"

export function calcBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null
  if (weightKg <= 0 || heightCm <= 0) return null
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  if (!Number.isFinite(bmi)) return null
  return Math.round(bmi * 10) / 10
}

export type BmiStatus = "unknown" | "under" | "healthy" | "over" | "obese"

export function bmiStatus(bmi: number | null | undefined): BmiStatus {
  if (bmi == null || !Number.isFinite(bmi)) return "unknown"
  if (bmi < 18.5) return "under"
  if (bmi < 25) return "healthy"
  if (bmi < 30) return "over"
  return "obese"
}

export function bmiLabel(status: BmiStatus): string {
  switch (status) {
    case "under":
      return "Underweight"
    case "healthy":
      return "Healthy"
    case "over":
      return "Overweight"
    case "obese":
      return "Obese"
    default:
      return "—"
  }
}

/**
 * Returns a hex color appropriate to render the BMI number in.
 *
 * Uses the existing palette: primary500 for healthy (teal), accent500 for
 * borderline (amber), angry500 for obese, neutral500 when unknown.
 */
export function bmiColor(bmi: number | null | undefined, theme: Theme): string {
  const s = bmiStatus(bmi)
  const { palette } = theme.colors
  switch (s) {
    case "healthy":
      return palette.primary500
    case "under":
    case "over":
      return palette.accent500
    case "obese":
      return palette.angry500
    default:
      return palette.neutral500
  }
}

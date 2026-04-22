/**
 * Diet-type chip colors, mirroring the web's meal-plans page `DIET_COLORS`.
 *
 * Web uses Tailwind tokens (e.g. `bg-orange-500/15 text-orange-600`). Here we
 * return a concrete background + foreground hex pair chosen to read well on
 * the light `neutral200` background. Fallbacks pull from the app palette
 * so unknown diet types don't stick out.
 *
 * Picks are intentionally muted — pill chips, not stickers. Tweak if any
 * feel off vs. the web version.
 */
import { colors as lightColors } from "@/theme/colors"

export interface DietChipColor {
  background: string
  foreground: string
}

// 15%-ish alpha washes of each hue, text color at a readable saturation.
const DIET_COLORS: Record<string, DietChipColor> = {
  omnivore: { background: "rgba(249, 115, 22, 0.15)", foreground: "#C2410C" },
  vegetarian: { background: "rgba(16, 185, 129, 0.15)", foreground: "#047857" },
  vegan: { background: "rgba(34, 197, 94, 0.15)", foreground: "#15803D" },
  pescatarian: { background: "rgba(14, 165, 233, 0.15)", foreground: "#0369A1" },
  keto: { background: "rgba(139, 92, 246, 0.15)", foreground: "#6D28D9" },
  paleo: { background: "rgba(20, 184, 166, 0.15)", foreground: "#0F766E" },
}

export function dietChipColor(dietType?: string | null): DietChipColor {
  const key = (dietType ?? "").toLowerCase()
  return (
    DIET_COLORS[key] ?? {
      background: lightColors.palette.neutral300,
      foreground: lightColors.palette.neutral700,
    }
  )
}

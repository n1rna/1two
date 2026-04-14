"use client";

import { useEffect, useRef } from "react";
import { useKim } from "./kim-provider";

/**
 * Register a listener for when a specific agent tool fires with data.
 * Example: listen for `generate_meal_plan` on the meal-plan create page so
 * you can auto-navigate to the new plan's detail page.
 */
export function useKimEffect(
  tool: string,
  handler: (data: Record<string, unknown>) => void,
) {
  const { registerEffectListener } = useKim();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return registerEffectListener(tool, (data) => handlerRef.current(data));
  }, [tool, registerEffectListener]);
}

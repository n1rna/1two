import { useEffect, useRef, useState } from "react";

/**
 * Tracks the width of a container element via ResizeObserver.
 * Returns a ref to attach to the element and the current width.
 */
export function useContainerWidth<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number>(Infinity);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

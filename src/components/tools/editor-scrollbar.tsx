"use client";

import { useRef, useEffect, useCallback } from "react";

interface EditorScrollbarProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  markers?: { line: number; color?: string }[];
  totalLines?: number;
}

export function EditorScrollbar({
  scrollContainerRef,
  markers,
  totalLines,
}: EditorScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Update viewport indicator via direct DOM — no React re-renders
  useEffect(() => {
    const container = scrollContainerRef.current;
    const viewport = viewportRef.current;
    if (!container || !viewport) return;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight <= 0) return;
      const top = (scrollTop / scrollHeight) * 100;
      const height = Math.max((clientHeight / scrollHeight) * 100, 2);
      viewport.style.top = `${top}%`;
      viewport.style.height = `${height}%`;
    };

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };

    update();
    container.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [scrollContainerRef]);

  // Drag on the scrollbar track
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const track = trackRef.current;
      const container = scrollContainerRef.current;
      if (!track || !container) return;

      const rect = track.getBoundingClientRect();
      const setScroll = (clientY: number) => {
        const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        container.scrollTop =
          ratio * container.scrollHeight - container.clientHeight / 2;
      };
      setScroll(e.clientY);

      const onMouseMove = (e: MouseEvent) => setScroll(e.clientY);
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "pointer";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [scrollContainerRef]
  );

  const denom = Math.max((totalLines ?? 1) - 1, 1);

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      className="relative w-3 shrink-0 border-l border-border/50 bg-muted/20 cursor-pointer"
    >
      {/* Viewport indicator */}
      <div
        ref={viewportRef}
        className="absolute left-0 right-0 bg-foreground/8 border-y border-foreground/10"
      />
      {/* Optional markers */}
      {markers &&
        totalLines &&
        markers.map((m) => {
          const topPct = ((m.line - 1) / denom) * 100;
          return (
            <div
              key={m.line}
              className="absolute left-0.5 right-0.5 rounded-sm"
              style={{
                top: `${topPct}%`,
                height: "max(2px, 0.3%)",
                backgroundColor: m.color ?? "var(--primary)",
              }}
            />
          );
        })}
    </div>
  );
}

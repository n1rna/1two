"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Plus,
  Pin,
  PinOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolTab {
  id: string;
  type: string;
  title?: string;
  chatNum?: number;
  pinned?: boolean;
}

export interface ToolTabBarProps {
  tabs: ToolTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Label map: tab type -> display label */
  labels: Record<string, string>;
  /** Icon map: tab type -> React node */
  icons: Record<string, React.ReactNode>;
  /** Color map: tab type -> className string */
  colors: Record<string, string>;
  /** If provided, enables drag-to-reorder */
  onReorder?: (tabs: ToolTab[]) => void;
  /** If provided, enables pin/unpin via context menu */
  onPin?: (id: string) => void;
  /** If provided, shows a + button for new chat */
  onNewChat?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ToolTabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  sidebarOpen,
  onToggleSidebar,
  labels,
  icons,
  colors,
  onReorder,
  onPin,
  onNewChat,
}: ToolTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    tabId: string;
    x: number;
    y: number;
  } | null>(null);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  // Sort tabs: pinned first, preserve order within groups
  const sortedTabs = useMemo(() => {
    if (!onPin) return tabs;
    const pinned = tabs.filter((t) => t.pinned);
    const unpinned = tabs.filter((t) => !t.pinned);
    return [...pinned, ...unpinned];
  }, [tabs, onPin]);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Convert vertical scroll to horizontal when cursor is on the tab bar
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("scroll", checkOverflow, { passive: true });
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("scroll", checkOverflow);
      ro.disconnect();
    };
  }, [checkOverflow]);

  useEffect(() => {
    checkOverflow();
  }, [tabs.length, checkOverflow]);

  // Scroll active tab into view
  useEffect(() => {
    if (!activeTabId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(
      `[data-tab-id="${CSS.escape(activeTabId)}"]`
    ) as HTMLElement | null;
    if (el)
      el.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
  }, [activeTabId]);

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };

  const canDrag = !!onReorder;
  const canPin = !!onPin;

  return (
    <div className="relative shrink-0 border-b bg-muted/10 flex items-center">
      <button
        onClick={onToggleSidebar}
        className="shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
        title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-3.5 w-3.5" />
        ) : (
          <PanelLeft className="h-3.5 w-3.5" />
        )}
      </button>
      <div
        ref={scrollRef}
        className="flex items-end overflow-x-auto min-h-[36px] hide-scrollbar flex-1"
      >
        {sortedTabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isDragging = canDrag && dragId === tab.id;
          const isDropTarget =
            canDrag && dropTarget === tab.id && dragId !== tab.id;
          const isPinned = canPin && !!tab.pinned;
          const label =
            tab.title ??
            (tab.type === "chat" && tab.chatNum != null
              ? `Chat #${tab.chatNum}`
              : labels[tab.type] ?? tab.type);

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              draggable={canDrag}
              onDragStart={
                canDrag
                  ? (e) => {
                      setDragId(tab.id);
                      e.dataTransfer.effectAllowed = "move";
                      const img = new Image();
                      img.src =
                        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                      e.dataTransfer.setDragImage(img, 0, 0);
                    }
                  : undefined
              }
              onDragOver={
                canDrag
                  ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setDropTarget(tab.id);
                    }
                  : undefined
              }
              onDragLeave={
                canDrag
                  ? () =>
                      setDropTarget((prev) =>
                        prev === tab.id ? null : prev
                      )
                  : undefined
              }
              onDrop={
                canDrag
                  ? (e) => {
                      e.preventDefault();
                      if (dragId && dragId !== tab.id) {
                        const fromIdx = tabs.findIndex(
                          (t) => t.id === dragId
                        );
                        const toIdx = tabs.findIndex(
                          (t) => t.id === tab.id
                        );
                        if (fromIdx !== -1 && toIdx !== -1) {
                          const reordered = [...tabs];
                          const [moved] = reordered.splice(fromIdx, 1);
                          reordered.splice(toIdx, 0, moved);
                          onReorder!(reordered);
                        }
                      }
                      setDragId(null);
                      setDropTarget(null);
                    }
                  : undefined
              }
              onDragEnd={
                canDrag
                  ? () => {
                      setDragId(null);
                      setDropTarget(null);
                    }
                  : undefined
              }
              onContextMenu={
                canPin
                  ? (e) => {
                      e.preventDefault();
                      setCtxMenu({
                        tabId: tab.id,
                        x: e.clientX,
                        y: e.clientY,
                      });
                    }
                  : undefined
              }
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs",
                "border-r border-border/50 shrink-0 max-w-[180px] group transition-colors",
                canDrag && "cursor-grab select-none",
                isActive
                  ? "bg-background border-b-2 border-b-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                isPinned &&
                  !isActive &&
                  "bg-primary/[0.04] text-foreground/80",
                isDragging && "opacity-40",
                isDropTarget && "border-l-2 border-l-primary"
              )}
              onClick={() => onSelect(tab.id)}
            >
              <span
                className={cn(
                  "shrink-0",
                  isActive
                    ? colors[tab.type] ?? ""
                    : "text-muted-foreground"
                )}
              >
                {icons[tab.type]}
              </span>
              <span className="truncate font-medium">{label}</span>
              {isPinned ? (
                <Pin className="h-2.5 w-2.5 shrink-0 text-primary/50 -mr-0.5 rotate-45" />
              ) : (
                <button
                  className={cn(
                    "shrink-0 rounded hover:bg-muted transition-colors p-0.5 -mr-0.5",
                    isActive
                      ? "opacity-60 hover:opacity-100"
                      : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                  aria-label={`Close ${label}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* Context menu */}
        {canPin && ctxMenu && (
          <div
            className="fixed z-50 min-w-[140px] rounded-md border bg-popover py-1 shadow-md text-popover-foreground animate-in fade-in-0 zoom-in-95"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const t = tabs.find((t) => t.id === ctxMenu.tabId);
              const pinned = !!t?.pinned;
              return (
                <>
                  <button
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                    onClick={() => {
                      onPin!(ctxMenu.tabId);
                      setCtxMenu(null);
                    }}
                  >
                    {pinned ? (
                      <PinOff className="size-3" />
                    ) : (
                      <Pin className="size-3" />
                    )}
                    {pinned ? "Unpin tab" : "Pin tab"}
                  </button>
                  {!pinned && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent text-destructive transition-colors"
                      onClick={() => {
                        onClose(ctxMenu.tabId);
                        setCtxMenu(null);
                      }}
                    >
                      <X className="size-3" />
                      Close tab
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {onNewChat && (
          <button
            className="flex items-center justify-center h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-sm transition-colors"
            onClick={onNewChat}
            aria-label="New chat"
            title="New Chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Scroll-right fade indicator */}
      {canScrollRight && (
        <button
          onClick={scrollRight}
          className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end pr-1.5 transition-opacity"
          style={{
            background:
              "linear-gradient(to right, transparent, var(--background) 60%)",
          }}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

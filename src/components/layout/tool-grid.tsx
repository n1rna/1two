"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { tools, categoryLabels } from "@/lib/tools/registry";
import type { ToolDefinition } from "@/lib/tools/registry";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  loadBookmarks,
  saveBookmarks,
  loadToolOrder,
  saveToolOrder,
} from "@/lib/tools/preferences";
import { useSession } from "@/lib/auth-client";

function getIcon(name: string) {
  const Icon = (
    Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>
  )[name];
  return Icon || Icons.Wrench;
}

function AuthBadge({ requiresAuth, loggedIn }: { requiresAuth?: boolean; loggedIn: boolean }) {
  if (!requiresAuth) return null;
  return loggedIn ? (
    <Icons.UserCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
  ) : (
    <Icons.Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
  );
}

function SortableToolCard({
  tool,
  bookmarked,
  onToggleBookmark,
  loggedIn,
  index,
  hovered,
  onHover,
}: {
  tool: ToolDefinition;
  bookmarked: boolean;
  onToggleBookmark: (slug: string) => void;
  loggedIn: boolean;
  index: number;
  hovered: number | null;
  onHover: (index: number | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tool.slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const Icon = getIcon(tool.icon);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className="relative group block p-1.5"
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Animated hover background */}
      <AnimatePresence>
        {hovered === index && (
          <motion.span
            className="absolute inset-0 h-full w-full bg-accent/60 block rounded-2xl"
            layoutId="toolHoverBg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.15 } }}
            exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.1 } }}
          />
        )}
      </AnimatePresence>

      <Link href={`/tools/${tool.slug}`} className="block h-full relative z-10">
        <div
          className={`h-full rounded-xl border bg-card p-5 transition-colors ${
            isDragging ? "shadow-lg" : ""
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="outline" className="text-xs">
              {categoryLabels[tool.category]}
            </Badge>
            <AuthBadge requiresAuth={tool.requiresAuth} loggedIn={loggedIn} />
          </div>
          <h3 className="text-base font-semibold tracking-tight">{tool.name}</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
            {tool.description}
          </p>
        </div>
      </Link>

      {/* Bookmark button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleBookmark(tool.slug);
        }}
        className={`absolute top-4 right-4 z-20 p-1.5 rounded-md transition-all ${
          bookmarked
            ? "text-amber-500 opacity-100"
            : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-500"
        }`}
        title={bookmarked ? "Remove bookmark" : "Bookmark"}
      >
        <Icons.Star
          className="h-4 w-4"
          fill={bookmarked ? "currentColor" : "none"}
        />
      </button>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute bottom-4 right-4 z-20 p-1.5 rounded-md text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-all"
        title="Drag to reorder"
      >
        <Icons.GripVertical className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export function ToolGrid() {
  const { data: session } = useSession();
  const loggedIn = !!session;
  const [mounted, setMounted] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    setBookmarks(new Set(loadBookmarks()));
    setOrder(loadToolOrder());
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const toggleBookmark = useCallback(
    (slug: string) => {
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) {
          next.delete(slug);
        } else {
          next.add(slug);
        }
        saveBookmarks([...next]);
        return next;
      });
      // Dispatch after state update to avoid setState-during-render in ToolLauncher
      setTimeout(() => window.dispatchEvent(new CustomEvent("bookmarks-changed")), 0);
    },
    []
  );

  // Build ordered tool list
  const orderedTools = (() => {
    if (!mounted) return tools;

    const toolMap = new Map(tools.map((t) => [t.slug, t]));
    const result: ToolDefinition[] = [];

    // Add tools in saved order
    for (const slug of order) {
      const tool = toolMap.get(slug);
      if (tool) {
        result.push(tool);
        toolMap.delete(slug);
      }
    }

    // Add remaining tools not in saved order
    for (const tool of tools) {
      if (toolMap.has(tool.slug)) {
        result.push(tool);
      }
    }

    // Sort: bookmarked first, then rest in order
    const bookmarkedTools = result.filter((t) => bookmarks.has(t.slug));
    const unbookmarkedTools = result.filter((t) => !bookmarks.has(t.slug));
    return [...bookmarkedTools, ...unbookmarkedTools];
  })();

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = orderedTools.findIndex((t) => t.slug === active.id);
      const newIndex = orderedTools.findIndex((t) => t.slug === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...orderedTools.map((t) => t.slug)];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, active.id as string);
      setOrder(newOrder);
      saveToolOrder(newOrder);
    },
    [orderedTools]
  );

  if (!mounted) {
    // SSR / initial render — no reorder, bookmarks, or animations
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
        {tools.map((tool) => {
          const Icon = getIcon(tool.icon);
          return (
            <Link key={tool.slug} href={`/tools/${tool.slug}`} className="block p-1.5">
              <div className="h-full rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {categoryLabels[tool.category]}
                  </Badge>
                  <AuthBadge requiresAuth={tool.requiresAuth} loggedIn={false} />
                </div>
                <h3 className="text-base font-semibold tracking-tight">{tool.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {tool.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={orderedTools.map((t) => t.slug)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
          {orderedTools.map((tool, index) => (
            <SortableToolCard
              key={tool.slug}
              tool={tool}
              bookmarked={bookmarks.has(tool.slug)}
              onToggleBookmark={toggleBookmark}
              loggedIn={loggedIn}
              index={index}
              hovered={hoveredIndex}
              onHover={setHoveredIndex}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

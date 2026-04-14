"use client";

import { useState, useCallback, useMemo, useRef, useEffect, memo } from "react";
import { ChevronRight, ChevronDown, CopyIcon, CheckIcon } from "lucide-react";
import { buildJsonPath } from "@/lib/tools/json";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface JsonTreeProps {
  data: unknown;
  searchQuery?: string;
  defaultExpanded?: boolean;
  expandGeneration?: number;
}

const CHILDREN_PAGE_SIZE = 100;

// Check if a value (recursively) contains a key matching the query.
// Uses a depth limit to avoid freezing on huge objects.
function hasMatchInSubtree(value: unknown, query: string, depthLeft: number): boolean {
  if (depthLeft <= 0) return false;

  // Check primitive values
  if (value === null || value === undefined) return "null".includes(query);
  if (typeof value === "string") return value.toLowerCase().includes(query);
  if (typeof value === "number" || typeof value === "boolean")
    return String(value).toLowerCase().includes(query);
  if (typeof value !== "object") return false;

  if (Array.isArray(value)) {
    for (const item of value) {
      if (hasMatchInSubtree(item, query, depthLeft - 1)) return true;
    }
    return false;
  }

  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (key.toLowerCase().includes(query)) return true;
    if (hasMatchInSubtree((value as Record<string, unknown>)[key], query, depthLeft - 1)) return true;
  }
  return false;
}

export function JsonTree({
  data,
  searchQuery,
  defaultExpanded = true,
  expandGeneration,
}: JsonTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to first match when search changes
  useEffect(() => {
    if (!searchQuery || !containerRef.current) return;
    const timer = setTimeout(() => {
      const match = containerRef.current?.querySelector("[data-search-match]");
      if (match) {
        match.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="font-mono text-sm" ref={containerRef}>
      <JsonNode
        value={data}
        path={[]}
        depth={0}
        searchQuery={searchQuery?.toLowerCase()}
        defaultExpanded={defaultExpanded}
        expandGeneration={expandGeneration}
      />
    </div>
  );
}

interface JsonNodeProps {
  keyName?: string | number;
  value: unknown;
  path: (string | number)[];
  depth: number;
  isLast?: boolean;
  searchQuery?: string;
  defaultExpanded: boolean;
  expandGeneration?: number;
}

const JsonNode = memo(function JsonNode({
  keyName,
  value,
  path,
  depth,
  isLast = true,
  searchQuery,
  defaultExpanded,
  expandGeneration,
}: JsonNodeProps) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [visibleCount, setVisibleCount] = useState(CHILDREN_PAGE_SIZE);
  const prevGeneration = useRef(expandGeneration);
  const prevQuery = useRef(searchQuery);

  useEffect(() => {
    if (expandGeneration !== prevGeneration.current) {
      setManualExpanded(null);
      setVisibleCount(CHILDREN_PAGE_SIZE);
      prevGeneration.current = expandGeneration;
    }
  }, [expandGeneration]);

  // Reset manual override when search changes
  useEffect(() => {
    if (searchQuery !== prevQuery.current) {
      setManualExpanded(null);
      prevQuery.current = searchQuery;
    }
  }, [searchQuery]);

  const isObject =
    value !== null && typeof value === "object" && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const entries = useMemo(() => {
    if (isArray) return value.map((v, i) => [i, v] as [number, unknown]);
    if (isObject)
      return Object.entries(value as Record<string, unknown>).map(
        ([k, v]) => [k, v] as [string, unknown]
      );
    return [];
  }, [value, isArray, isObject]);

  const keyMatches =
    searchQuery &&
    keyName !== undefined &&
    String(keyName).toLowerCase().includes(searchQuery);

  const valueMatches =
    searchQuery &&
    !isExpandable &&
    value !== undefined &&
    String(value).toLowerCase().includes(searchQuery);

  const matchesSearch = keyMatches || valueMatches;

  // Check if any descendant matches - only when searching and node is expandable
  const descendantMatches = useMemo(() => {
    if (!searchQuery || !isExpandable) return false;
    return hasMatchInSubtree(value, searchQuery, 10);
  }, [searchQuery, value, isExpandable]);

  // Determine expanded state: manual override > search auto-expand > default
  const expanded = useMemo(() => {
    if (manualExpanded !== null) return manualExpanded;
    if (searchQuery && descendantMatches) return true;
    return defaultExpanded && depth < 3;
  }, [manualExpanded, searchQuery, descendantMatches, defaultExpanded, depth]);

  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const count = entries.length;
  const comma = isLast ? "" : ",";

  // When searching, find matching entries beyond the visible window
  const matchingIndices = useMemo(() => {
    if (!isExpandable || !searchQuery) return null;
    const indices: number[] = [];
    for (let i = visibleCount; i < entries.length; i++) {
      const [k, v] = entries[i];
      if (String(k).toLowerCase().includes(searchQuery)) {
        indices.push(i);
      } else if (hasMatchInSubtree(v, searchQuery, 10)) {
        indices.push(i);
      }
    }
    return indices.length > 0 ? indices : null;
  }, [searchQuery, entries, visibleCount, isExpandable]);

  const hasMore = visibleCount < entries.length;

  // Build the children list: visible entries + search matches with gap indicators
  const childrenContent = useMemo(() => {
    if (!isExpandable) return null;
    const nodes: React.ReactNode[] = [];
    const visibleEntries = entries.slice(0, visibleCount);
    const remaining = entries.length - visibleCount;

    visibleEntries.forEach(([k, v], i) => {
      nodes.push(
        <JsonNode
          key={String(k)}
          keyName={k}
          value={v}
          path={[...path, k]}
          depth={depth + 1}
          isLast={!hasMore && !matchingIndices && i === visibleEntries.length - 1}
          searchQuery={searchQuery}
          defaultExpanded={defaultExpanded}
          expandGeneration={expandGeneration}
        />
      );
    });

    if (hasMore && matchingIndices) {
      // Show gap + matching entries
      let lastShownIndex = visibleCount - 1;
      for (const idx of matchingIndices) {
        const gap = idx - lastShownIndex - 1;
        if (gap > 0) {
          nodes.push(
            <div key={`gap-${idx}`} className="leading-6 text-xs text-muted-foreground/50 px-1 select-none">
              ··· {gap.toLocaleString()} {gap === 1 ? "item" : "items"}
            </div>
          );
        }
        const [k, v] = entries[idx];
        nodes.push(
          <JsonNode
            key={String(k)}
            keyName={k}
            value={v}
            path={[...path, k]}
            depth={depth + 1}
            isLast={false}
            searchQuery={searchQuery}
            defaultExpanded={defaultExpanded}
            expandGeneration={expandGeneration}
          />
        );
        lastShownIndex = idx;
      }
      // Trailing gap
      const trailingGap = entries.length - lastShownIndex - 1;
      if (trailingGap > 0) {
        nodes.push(
          <button
            key="load-more"
            onClick={() => setVisibleCount((c) => c + CHILDREN_PAGE_SIZE)}
            className="leading-6 text-xs text-muted-foreground hover:text-foreground px-1"
          >
            ··· {remaining.toLocaleString()} more - click to load
          </button>
        );
      }
    } else if (hasMore) {
      nodes.push(
        <button
          key="load-more"
          onClick={() => setVisibleCount((c) => c + CHILDREN_PAGE_SIZE)}
          className="leading-6 text-xs text-muted-foreground hover:text-foreground px-1"
        >
          ··· {remaining.toLocaleString()} more {remaining === 1 ? "item" : "items"} - click to show
        </button>
      );
    }

    return nodes;
  }, [isExpandable, entries, visibleCount, matchingIndices, hasMore, path, depth, searchQuery, defaultExpanded, expandGeneration]);

  if (!isExpandable) {
    return (
      <div
        className="flex items-start leading-6 hover:bg-muted/50 rounded px-1 -mx-1 group"
        {...(matchesSearch ? { "data-search-match": "" } : {})}
      >
        {keyName !== undefined && (
          <KeyLabel
            keyName={keyName}
            path={path}
            highlight={!!keyMatches}
          />
        )}
        <ValueDisplay value={value} highlight={!!valueMatches} />
        <span className="text-muted-foreground">{comma}</span>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div
        className="flex items-start leading-6 hover:bg-muted/50 rounded px-1 -mx-1 group"
        {...(matchesSearch ? { "data-search-match": "" } : {})}
      >
        <button
          onClick={() => setManualExpanded(true)}
          className="shrink-0 mr-1 p-0.5 rounded hover:bg-muted text-muted-foreground"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
        {keyName !== undefined && (
          <KeyLabel
            keyName={keyName}
            path={path}
            highlight={!!keyMatches}
          />
        )}
        <span className="text-muted-foreground">
          {openBracket}
          <span className="mx-1 text-xs">
            {count.toLocaleString()} {count === 1 ? "item" : "items"}
          </span>
          {closeBracket}
          {comma}
        </span>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-start leading-6 hover:bg-muted/50 rounded px-1 -mx-1 group"
        {...(matchesSearch ? { "data-search-match": "" } : {})}
      >
        <button
          onClick={() => setManualExpanded(false)}
          className="shrink-0 mr-1 p-0.5 rounded hover:bg-muted text-muted-foreground"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
        {keyName !== undefined && (
          <KeyLabel
            keyName={keyName}
            path={path}
            highlight={!!keyMatches}
          />
        )}
        <span className="text-muted-foreground">
          {openBracket}
          {count > CHILDREN_PAGE_SIZE && (
            <span className="ml-1 text-xs">{count.toLocaleString()} items</span>
          )}
        </span>
      </div>
      <div className="ml-5 border-l border-border/50 pl-3">
        {childrenContent}
      </div>
      <div className="flex items-start leading-6 px-1 -mx-1">
        <span className="ml-5 text-muted-foreground">
          {closeBracket}
          {comma}
        </span>
      </div>
    </div>
  );
});

const KeyLabel = memo(function KeyLabel({
  keyName,
  path,
  highlight,
}: {
  keyName: string | number;
  path: (string | number)[];
  highlight?: boolean;
}) {
  const jsonPath = buildJsonPath(path);
  const [copied, setCopied] = useState(false);

  const copyPath = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(jsonPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [jsonPath]
  );

  const isIndex = typeof keyName === "number";

  return (
    <Tooltip>
      <TooltipTrigger
        className={`shrink-0 mr-1 cursor-default ${
          highlight
            ? "bg-yellow-500/20 rounded px-0.5"
            : ""
        }`}
      >
        {isIndex ? (
          <span className="text-muted-foreground">{keyName}</span>
        ) : (
          <span className="text-blue-400">&quot;{String(keyName)}&quot;</span>
        )}
        <span className="text-muted-foreground">: </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="flex items-center gap-2 font-mono text-xs"
      >
        <span>{jsonPath}</span>
        <button onClick={copyPath} className="hover:text-foreground text-muted-foreground">
          {copied ? (
            <CheckIcon className="h-3 w-3" />
          ) : (
            <CopyIcon className="h-3 w-3" />
          )}
        </button>
      </TooltipContent>
    </Tooltip>
  );
});

const ValueDisplay = memo(function ValueDisplay({ value, highlight }: { value: unknown; highlight?: boolean }) {
  const cls = highlight ? "bg-yellow-500/20 rounded px-0.5" : "";
  if (value === null) {
    return <span className={`text-orange-400 italic ${cls}`}>null</span>;
  }
  if (typeof value === "boolean") {
    return <span className={`text-orange-400 ${cls}`}>{String(value)}</span>;
  }
  if (typeof value === "number") {
    return <span className={`text-green-400 ${cls}`}>{String(value)}</span>;
  }
  if (typeof value === "string") {
    const display = value.length > 500 ? value.slice(0, 500) + "…" : value;
    return (
      <span className={`text-amber-300 ${cls}`}>
        &quot;{display}&quot;
      </span>
    );
  }
  return <span className={`text-muted-foreground ${cls}`}>{String(value)}</span>;
});

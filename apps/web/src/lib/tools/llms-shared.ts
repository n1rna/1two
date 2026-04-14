// Shared types and helpers for the llms.txt tool — used by generator, job detail, and history popover

export type ScanDepth = 0 | 1 | 3 | 5;
export type DetailLevel = "overview" | "standard" | "detailed";
export type JobStatus = "pending" | "crawling" | "processing" | "completed" | "failed" | "cancelled";

export interface CacheInfo {
  cached: boolean;
  cachedAt?: string;
  pagesCount?: number;
}

export interface JobFile {
  id: string;
  fileName: string;
  size: number;
  version: string;
  content?: string;
  slug?: string;
  published?: boolean;
}

export interface JobResponse {
  id: string;
  url: string;
  status: JobStatus;
  error?: string;
  pagesCrawled: number;
  tokensUsed: number;
  detailLevel: string;
  files?: JobFile[];
  createdAt: string;
  completedAt?: string;
}

export interface FileInfo {
  downloadUrl: string;
  fileName: string;
  size: number;
}

export interface PublishResponse {
  id: string;
  fileName: string;
  size: number;
  version: string;
  slug: string;
  published: boolean;
  publicUrl?: string;
}

export function isValidUrl(val: string): boolean {
  try {
    const u = new URL(val);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function statusColor(status: string): string {
  switch (status) {
    case "completed": return "text-green-600 dark:text-green-400";
    case "failed": return "text-destructive";
    case "cancelled": return "text-muted-foreground";
    case "pending":
    case "crawling":
    case "processing": return "text-blue-600 dark:text-blue-400";
    default: return "text-muted-foreground";
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case "completed": return "Completed";
    case "failed": return "Failed";
    case "cancelled": return "Cancelled";
    case "pending": return "Queued";
    case "crawling": return "Crawling";
    case "processing": return "Processing";
    default: return status;
  }
}

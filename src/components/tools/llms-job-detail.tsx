"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Share2,
  ExternalLink,
  X,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  type JobResponse,
  type FileInfo,
  type PublishResponse,
  type JobStatus,
  formatSize,
} from "@/lib/tools/llms-shared";
import { CopyButton, ProgressView } from "@/components/tools/llms-txt-generator";

// ─── Job Detail Component ─────────────────────────────────────────────────────

export function LlmsJobDetail({ jobId }: { jobId: string }) {
  const { data: session } = useSession();
  const router = useRouter();

  const [job, setJob] = useState<JobResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Result-specific state
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  // Progress-specific state
  const [liveStatus, setLiveStatus] = useState<JobStatus>("pending");
  const [pagesCrawled, setPagesCrawled] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Fetch file download info helper
  const fetchFileInfo = useCallback(async (fileId: string) => {
    try {
      const res = await fetch(`/api/proxy/llms/files/${fileId}`, { credentials: "include" });
      if (res.ok) {
        const fi: FileInfo = await res.json();
        setFileInfo(fi);
      }
    } catch {
      // silently ignore
    }
  }, []);

  // Poll for in-progress job
  const pollJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/proxy/llms/jobs/${id}`, { credentials: "include" });
        if (!res.ok) return;
        const data: JobResponse = await res.json();
        setLiveStatus(data.status);
        setPagesCrawled(data.pagesCrawled);

        if (data.status === "completed") {
          stopPolling();
          setJob(data);
          const firstFile = data.files?.[0];
          if (firstFile?.published && firstFile.slug) {
            setPublishedSlug(firstFile.slug);
            setPublishedUrl(`${window.location.origin}/s/${firstFile.slug}`);
          }
          if (firstFile?.id) fetchFileInfo(firstFile.id);
        } else if (data.status === "failed" || data.status === "cancelled") {
          stopPolling();
          setJob(data);
        }
      } catch {
        // silently ignore
      }
    },
    [stopPolling, fetchFileInfo]
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/proxy/llms/jobs/${jobId}`, { credentials: "include" });
        if (!res.ok) {
          setError(res.status === 404 ? "Job not found." : `Failed to load job (${res.status}).`);
          return;
        }
        const data: JobResponse = await res.json();
        if (cancelled) return;

        setJob(data);
        setLiveStatus(data.status);
        setPagesCrawled(data.pagesCrawled);

        if (data.status === "completed") {
          const firstFile = data.files?.[0];
          if (firstFile?.published && firstFile.slug) {
            setPublishedSlug(firstFile.slug);
            setPublishedUrl(`${window.location.origin}/s/${firstFile.slug}`);
          }
          if (firstFile?.id) fetchFileInfo(firstFile.id);
        } else if (data.status === "pending" || data.status === "crawling" || data.status === "processing") {
          // Start polling
          pollRef.current = setInterval(() => pollJob(jobId), 2000);
          pollJob(jobId);
        }
      } catch {
        if (!cancelled) setError("Failed to load job.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [jobId, fetchFileInfo, pollJob, stopPolling]);

  // ── Download ──────────────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    const fileId = job?.files?.[0]?.id;
    if (!fileId && !fileInfo) return;
    setDownloading(true);
    try {
      let downloadUrl = fileInfo?.downloadUrl;
      if (!downloadUrl && fileId) {
        const res = await fetch(`/api/proxy/llms/files/${fileId}`, { credentials: "include" });
        if (res.ok) {
          const fi: FileInfo = await res.json();
          setFileInfo(fi);
          downloadUrl = fi.downloadUrl;
        }
      }
      if (downloadUrl) {
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = fileInfo?.fileName ?? "llms.txt";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch {
      // silently ignore
    } finally {
      setDownloading(false);
    }
  }, [job, fileInfo]);

  // ── Publish / Unpublish ───────────────────────────────────────────────────

  const handlePublish = useCallback(async () => {
    const fileId = job?.files?.[0]?.id;
    if (!fileId) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/proxy/llms/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ published: true }),
      });
      if (res.ok) {
        const data: PublishResponse = await res.json();
        if (data.publicUrl) {
          const fullUrl = `${window.location.origin}${data.publicUrl}`;
          setPublishedUrl(fullUrl);
          setPublishedSlug(data.slug);
        }
      }
    } catch {
      // silently ignore
    } finally {
      setPublishing(false);
    }
  }, [job]);

  const handleUnpublish = useCallback(async () => {
    const fileId = job?.files?.[0]?.id;
    if (!fileId) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/proxy/llms/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ published: false }),
      });
      if (res.ok) {
        setPublishedUrl(null);
        setPublishedSlug(null);
      }
    } catch {
      // silently ignore
    } finally {
      setPublishing(false);
    }
  }, [job]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-xl mx-auto flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error ?? "Job not found."}</span>
        </div>
        <button
          onClick={() => router.push("/tools/llms-txt")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to generator
        </button>
      </div>
    );
  }

  // ── In-progress view ──────────────────────────────────────────────────────

  const isInProgress =
    liveStatus === "pending" || liveStatus === "crawling" || liveStatus === "processing";

  if (isInProgress) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <ProgressView
          url={job.url}
          status={liveStatus}
          pagesCrawled={pagesCrawled}
        />
      </div>
    );
  }

  // ── Failed / Cancelled ────────────────────────────────────────────────────

  if (job.status === "failed" || job.status === "cancelled") {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {job.status === "cancelled"
              ? "This generation was cancelled."
              : job.error ?? "Generation failed."}
          </span>
        </div>
        <button
          onClick={() => router.push("/tools/llms-txt")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to generator
        </button>
      </div>
    );
  }

  // ── Completed view ────────────────────────────────────────────────────────

  const firstFile = job.files?.[0];
  const isPublished = !!(publishedUrl || firstFile?.published);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Success header */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/30 bg-green-500/5">
        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-500/15 shrink-0">
          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">llms.txt generated</p>
          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
            {job.pagesCrawled > 0 && <span>{job.pagesCrawled} pages analyzed</span>}
            {job.tokensUsed > 0 && <span>{job.tokensUsed.toLocaleString()} tokens</span>}
            {job.completedAt && job.createdAt && (
              <span>
                generated in{" "}
                {((new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()) / 1000).toFixed(1)}s
              </span>
            )}
            {firstFile && <span>{formatSize(firstFile.size)}</span>}
          </p>
        </div>
      </div>

      {/* Public URL banner */}
      {isPublished && publishedUrl && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-green-500/20 bg-green-500/5 text-xs">
          <ExternalLink className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="flex-1 truncate font-mono text-muted-foreground">{publishedUrl}</span>
          <CopyButton text={publishedUrl} label="Copy URL" className="shrink-0" />
        </div>
      )}

      {/* Content preview */}
      {firstFile?.content && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground font-mono">
              {firstFile.fileName}
            </span>
            <CopyButton text={firstFile.content} label="Copy" />
          </div>
          <pre className="px-4 py-3 text-xs font-mono leading-relaxed overflow-x-auto overflow-y-auto max-h-72 text-muted-foreground whitespace-pre-wrap break-words">
            {firstFile.content}
          </pre>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {firstFile?.content && (
          <CopyButton text={firstFile.content} label="Copy content" />
        )}
        {firstFile && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download
          </button>
        )}
        {firstFile && !isPublished && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {publishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            Share publicly
          </button>
        )}
        {isPublished && (
          <button
            onClick={handleUnpublish}
            disabled={publishing}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {publishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            Unpublish
          </button>
        )}
      </div>

    </div>
  );
}

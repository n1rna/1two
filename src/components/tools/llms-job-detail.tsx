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
  Globe,
  Sparkles,
  FileText,
  Bot,
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
import {
  CopyButton,
  ReasoningStep,
  ShimmerStyles,
  type StepStatus,
} from "@/components/tools/llms-txt-generator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusToSteps(status: JobStatus): [StepStatus, StepStatus, StepStatus] {
  switch (status) {
    case "pending":
      return ["active", "pending", "pending"];
    case "crawling":
      return ["active", "pending", "pending"];
    case "processing":
      return ["done", "active", "pending"];
    case "completed":
      return ["done", "done", "done"];
    case "failed":
    case "cancelled":
      return ["done", "done", "done"]; // show all as done so the error is visible
    default:
      return ["pending", "pending", "pending"];
  }
}

function elapsedSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 1000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

// ─── Job Detail Component ─────────────────────────────────────────────────────

export function LlmsJobDetail({ jobId }: { jobId: string }) {
  const { data: session } = useSession();
  const router = useRouter();

  const [job, setJob] = useState<JobResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  const [liveStatus, setLiveStatus] = useState<JobStatus>("pending");
  const [pagesCrawled, setPagesCrawled] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchFileInfo = useCallback(async (fileId: string) => {
    try {
      const res = await fetch(`/api/proxy/llms/files/${fileId}`, { credentials: "include" });
      if (res.ok) setFileInfo(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

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
          const f = data.files?.[0];
          if (f?.published && f.slug) {
            setPublishedSlug(f.slug);
            setPublishedUrl(`${window.location.origin}/s/${f.slug}`);
          }
          if (f?.id) fetchFileInfo(f.id);
        } else if (data.status === "failed" || data.status === "cancelled") {
          stopPolling();
          setJob(data);
        }
      } catch {
        /* ignore */
      }
    },
    [stopPolling, fetchFileInfo]
  );

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
          const f = data.files?.[0];
          if (f?.published && f.slug) {
            setPublishedSlug(f.slug);
            setPublishedUrl(`${window.location.origin}/s/${f.slug}`);
          }
          if (f?.id) fetchFileInfo(f.id);
        } else if (["pending", "crawling", "processing"].includes(data.status)) {
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
      /* ignore */
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
          setPublishedUrl(`${window.location.origin}${data.publicUrl}`);
          setPublishedSlug(data.slug);
        }
      }
    } catch {
      /* ignore */
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
      /* ignore */
    } finally {
      setPublishing(false);
    }
  }, [job]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading job...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
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

  const [step1, step2, step3] = statusToSteps(liveStatus);
  const isFailed = job.status === "failed" || job.status === "cancelled";
  const isCompleted = job.status === "completed";
  const firstFile = job.files?.[0];
  const isPublished = !!(publishedUrl || firstFile?.published);

  const totalDuration =
    isCompleted && job.completedAt && job.createdAt
      ? new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()
      : undefined;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <ShimmerStyles />

      {/* Back link */}
      <button
        onClick={() => router.push("/tools/llms-txt")}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to generator
      </button>

      {/* URL pill */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 w-fit max-w-full overflow-hidden">
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate font-mono">{job.url}</span>
      </div>

      {/* Step 1: Crawling */}
      <ReasoningStep
        icon={Globe}
        title="Crawling website"
        status={step1}
        duration={step1 === "done" && totalDuration ? Math.min(totalDuration * 0.5, totalDuration) : undefined}
      >
        <div className="text-xs text-muted-foreground space-y-1">
          {step1 === "active" && pagesCrawled > 0 && (
            <p>
              Found <span className="font-medium text-foreground">{pagesCrawled}</span> pages so far...
            </p>
          )}
          {step1 === "active" && pagesCrawled === 0 && (
            <p>Starting crawl...</p>
          )}
          {step1 === "done" && (
            <p>
              Crawled <span className="font-medium text-foreground">{job.pagesCrawled}</span> pages from{" "}
              <span className="font-medium text-foreground">
                {(() => { try { return new URL(job.url).hostname; } catch { return job.url; } })()}
              </span>
            </p>
          )}
        </div>
      </ReasoningStep>

      {/* Step 2: AI Analysis */}
      {step1 !== "pending" && (
        <ReasoningStep
          icon={Sparkles}
          title="Analyzing content with AI"
          status={step2}
          duration={step2 === "done" && totalDuration ? Math.min(totalDuration * 0.35, totalDuration) : undefined}
        >
          <div className="text-xs text-muted-foreground space-y-1">
            {step2 === "active" && (
              <p>Processing {job.pagesCrawled} pages through the AI model...</p>
            )}
            {step2 === "done" && job.tokensUsed > 0 && (
              <p>
                Processed with{" "}
                <span className="font-medium text-foreground">{job.tokensUsed.toLocaleString()}</span> tokens
              </p>
            )}
            {step2 === "done" && job.tokensUsed === 0 && (
              <p>Content analyzed</p>
            )}
          </div>
        </ReasoningStep>
      )}

      {/* Step 3: Generation result */}
      {step2 !== "pending" && (
        <ReasoningStep
          icon={FileText}
          title={isCompleted ? "llms.txt generated" : isFailed ? "Generation failed" : "Generating llms.txt"}
          status={step3}
          duration={step3 === "done" && totalDuration ? totalDuration : undefined}
          defaultOpen={isCompleted || isFailed}
        >
          {/* Failed state */}
          {isFailed && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {job.status === "cancelled"
                  ? "This generation was cancelled."
                  : job.error ?? "Generation failed."}
              </span>
            </div>
          )}

          {/* Completed state */}
          {isCompleted && firstFile && (
            <div className="space-y-3">
              {/* Stats */}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {job.pagesCrawled > 0 && (
                  <span>
                    <span className="font-medium text-foreground">{job.pagesCrawled}</span> pages
                  </span>
                )}
                {job.tokensUsed > 0 && (
                  <span>
                    <span className="font-medium text-foreground">{job.tokensUsed.toLocaleString()}</span> tokens
                  </span>
                )}
                {firstFile.size > 0 && (
                  <span>
                    <span className="font-medium text-foreground">{formatSize(firstFile.size)}</span>
                  </span>
                )}
                {totalDuration !== undefined && (
                  <span>
                    <span className="font-medium text-foreground">{(totalDuration / 1000).toFixed(1)}s</span> total
                  </span>
                )}
              </div>

              {/* Public URL */}
              {isPublished && publishedUrl && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/20 bg-green-500/5 text-xs">
                  <ExternalLink className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span className="flex-1 truncate font-mono text-muted-foreground">{publishedUrl}</span>
                  <CopyButton text={publishedUrl} label="Copy" className="shrink-0" />
                </div>
              )}

              {/* Content preview */}
              {firstFile.content && (
                <div className="rounded-lg border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
                    <span className="text-[11px] font-medium text-muted-foreground font-mono">
                      {firstFile.fileName}
                    </span>
                    <CopyButton text={firstFile.content} label="Copy" />
                  </div>
                  <pre className="px-3 py-2.5 text-[11px] font-mono leading-relaxed overflow-x-auto overflow-y-auto max-h-64 text-muted-foreground whitespace-pre-wrap break-words">
                    {firstFile.content}
                  </pre>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {firstFile.content && (
                  <CopyButton text={firstFile.content} label="Copy content" />
                )}
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
                {!isPublished && (
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
          )}
        </ReasoningStep>
      )}

      {/* Fire-and-forget message for in-progress jobs */}
      {!isCompleted && !isFailed && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          You can close this page. Check back later or find this job in your history.
        </p>
      )}
    </div>
  );
}

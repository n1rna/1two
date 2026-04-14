"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  History,
  Search,
  Loader2,
  X,
  Globe,
  ExternalLink,
  Plus,
  FileText,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  type JobResponse,
  timeAgo,
  formatSize,
  statusColor,
  statusLabel,
} from "@/lib/tools/llms-shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function LlmsToolbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isJobPage = pathname !== "/tools/llms-txt";

  // Extract jobId from /tools/llms-txt/{jobId}
  const jobId = isJobPage ? pathname.replace("/tools/llms-txt/", "") : null;

  return (
    <div className="flex items-center gap-1">
      {jobId && <CancelJobButton jobId={jobId} />}
      {isJobPage && (
        <Link
          href="/tools/llms-txt"
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Link>
      )}
      {session && <LlmsHistoryDialog />}
    </div>
  );
}

function CancelJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/proxy/llms/jobs/${jobId}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setStatus(data.status);
        }
      } catch { /* ignore */ }
    };
    check();
    // Re-check periodically while in progress
    const interval = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [jobId]);

  const isActive = status === "pending" || status === "crawling" || status === "processing";
  if (!isActive) return null;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await fetch(`/api/proxy/llms/jobs/${jobId}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch { /* ignore */ }
    // Navigate back, the job page will show cancelled state on next load
    router.refresh();
    setCancelling(false);
  };

  return (
    <button
      onClick={handleCancel}
      disabled={cancelling}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors",
        "text-destructive/80 hover:bg-destructive/10 hover:text-destructive",
        "disabled:opacity-40"
      )}
    >
      {cancelling ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <X className="h-3.5 w-3.5" />
      )}
      Cancel
    </button>
  );
}

function LlmsHistoryDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proxy/llms/jobs?limit=50&offset=0", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchJobs();
      setQuery("");
    }
  }, [open, fetchJobs]);

  const filtered = query.trim()
    ? jobs.filter((j) => j.url.toLowerCase().includes(query.toLowerCase()))
    : jobs;

  const handleSelect = (jobId: string) => {
    setOpen(false);
    router.push(`/tools/llms-txt/${jobId}`);
  };

  // Extract current job ID from path
  const currentJobId = pathname.startsWith("/tools/llms-txt/")
    ? pathname.replace("/tools/llms-txt/", "")
    : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Generation history"
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground"
        )}
      >
        <History className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Generation History</DialogTitle>
            <DialogDescription>Your llms.txt files and in-progress jobs.</DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by URL..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50"
              autoFocus
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Job list */}
          <div className="flex-1 overflow-y-auto -mx-4 px-4 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-12">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground py-12">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-sm">
                  {query ? "No matching generations." : "No generations yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-1 py-1">
                {filtered.map((job) => {
                  const firstFile = job.files?.[0];
                  const isCurrent = job.id === currentJobId;
                  const isActive = job.status === "pending" || job.status === "crawling" || job.status === "processing";

                  // Extract hostname for display
                  let hostname = job.url;
                  try { hostname = new URL(job.url).hostname; } catch { /* keep raw */ }

                  return (
                    <button
                      key={job.id}
                      onClick={() => handleSelect(job.id)}
                      className={cn(
                        "w-full flex items-start gap-3 px-3 py-3 rounded-lg transition-colors text-left group",
                        isCurrent
                          ? "bg-accent/80"
                          : "hover:bg-accent/50"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5",
                        job.status === "completed"
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : isActive
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {isActive ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Globe className="h-4 w-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{hostname}</p>
                          <span className={cn("text-xs font-medium shrink-0", statusColor(job.status))}>
                            {statusLabel(job.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{job.url}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{timeAgo(job.createdAt)}</span>
                          <span className="capitalize">{job.detailLevel}</span>
                          {firstFile && <span>{formatSize(firstFile.size)}</span>}
                          {firstFile?.published && (
                            <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400">
                              <ExternalLink className="h-3 w-3" />
                              published
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

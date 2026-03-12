"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Globe,
  Loader2,
  Check,
  Copy,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  FileText,
  LogIn,
  AlertCircle,
  Mail,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { SignInDialog } from "@/components/layout/sign-in-dialog";
import { cn } from "@/lib/utils";
import {
  isValidUrl,
  timeAgo,
  type ScanDepth,
  type DetailLevel,
  type JobStatus,
  type CacheInfo,
  type JobResponse,
} from "@/lib/tools/llms-shared";

// ─── Types ──────────────────────────────────────────────────────────────────

type Step = "input" | "options";

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div
      className={cn(
        "h-1.5 w-6 rounded-full transition-all duration-300",
        done ? "bg-green-500" : active ? "bg-foreground" : "bg-muted"
      )}
    />
  );
}

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
        "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─── Progress stage display ───────────────────────────────────────────────────

type ProgressStage = 1 | 2 | 3;

const STAGES: { label: string; icon: React.ReactNode }[] = [
  { label: "Crawling website", icon: <Globe className="h-4 w-4" /> },
  { label: "Analyzing content with AI", icon: <Sparkles className="h-4 w-4" /> },
  { label: "Generating llms.txt", icon: <FileText className="h-4 w-4" /> },
];

function jobStatusToStage(status: JobStatus): ProgressStage {
  if (status === "pending" || status === "crawling") return 1;
  if (status === "processing") return 2;
  return 3;
}

export function ProgressView({
  url,
  status,
  pagesCrawled,
}: {
  url: string;
  status: JobStatus;
  pagesCrawled: number;
}) {
  const stage = jobStatusToStage(status);

  return (
    <div className="space-y-6">
      {/* URL pill */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 w-fit max-w-full overflow-hidden">
        <Globe className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{url}</span>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        {STAGES.map((s, i) => {
          const idx = (i + 1) as ProgressStage;
          const isActive = stage === idx;
          const isDone = stage > idx;
          const isPending = stage < idx;

          return (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300",
                isActive
                  ? "border-primary/30 bg-primary/5"
                  : isDone
                  ? "border-green-500/20 bg-green-500/5"
                  : "border-border/50 opacity-40"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full shrink-0 transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : isDone
                    ? "bg-green-500/15 text-green-500"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? (
                  <Check className="h-4 w-4" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  s.icon
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", isPending && "text-muted-foreground")}>
                  {s.label}
                  {isActive && idx === 1 && pagesCrawled > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {pagesCrawled} pages found
                    </span>
                  )}
                </p>
              </div>
              {isActive && !isDone && (
                <div className="flex gap-0.5 shrink-0">
                  {[0, 1, 2].map((dot) => (
                    <div
                      key={dot}
                      className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse"
                      style={{ animationDelay: `${dot * 200}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fire and forget message */}
      <p className="text-xs text-muted-foreground text-center">
        You can close this page. Check back later or find this job in your history.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LlmsTxtGenerator() {
  const { data: session } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  const router = useRouter();

  // Step state
  const [step, setStep] = useState<Step>("input");

  // Step 1: Input
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [checkingCache, setCheckingCache] = useState(false);

  // Step 2: Options
  const [scanDepth, setScanDepth] = useState<ScanDepth>(0);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("standard");
  const [fileName, setFileName] = useState("llms");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cache check ────────────────────────────────────────────────────────────

  const checkCache = useCallback(async (rawUrl: string, depth: ScanDepth) => {
    if (!isValidUrl(rawUrl)) return;
    setCheckingCache(true);
    setCacheInfo(null);
    try {
      const params = new URLSearchParams({ url: rawUrl, depth: String(depth) });
      const res = await fetch(`/api/proxy/llms/cache?${params}`, { credentials: "include" });
      if (res.ok) {
        const data: CacheInfo = await res.json();
        setCacheInfo(data);
      }
    } catch {
      // silently ignore
    } finally {
      setCheckingCache(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isValidUrl(url)) {
      setCacheInfo(null);
      setUrlError(url && !isValidUrl(url) ? "Enter a valid URL starting with http:// or https://" : null);
      return;
    }
    setUrlError(null);
    debounceRef.current = setTimeout(() => {
      checkCache(url, scanDepth);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url, checkCache, scanDepth]);

  // ── Generate ───────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!session) {
      setSignInOpen(true);
      return;
    }
    setGenerating(true);
    setGenerateError(null);

    try {
      const res = await fetch("/api/proxy/llms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url,
          scanDepth,
          detailLevel,
          fileName: `${fileName.trim() || "llms"}.txt`,
          ...(notifyEmail.trim() ? { notifyEmail: notifyEmail.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const data: JobResponse = await res.json();

      // Redirect to the job page — it handles progress polling and results
      router.push(`/tools/llms-txt/${data.id}`);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Failed to start generation");
      setGenerating(false);
    }
  }, [session, url, scanDepth, detailLevel, fileName, notifyEmail, router]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const urlValid = isValidUrl(url);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Auth banner */}
      {!session && (
        <button
          onClick={() => setSignInOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/50 hover:bg-accent/50 transition-colors text-left"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 shrink-0">
            <LogIn className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sign in to generate llms.txt files</p>
            <p className="text-xs text-muted-foreground">
              Create a free account to crawl sites and generate AI context files.
            </p>
          </div>
        </button>
      )}

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />

      {/* Step indicators */}
      <div className="flex items-center gap-1.5">
        <StepDot active={step === "input"} done={step !== "input"} />
        <StepDot active={step === "options"} done={false} />
      </div>

      {/* ── Step 1: Input ── */}
      {step === "input" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Website URL
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Globe className="h-4 w-4" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.example.com or https://github.com/org/repo"
                className={cn(
                  "w-full pl-9 pr-4 py-3 rounded-xl border bg-card text-sm outline-none transition-colors",
                  "placeholder:text-muted-foreground/50",
                  "focus:ring-1 focus:ring-ring",
                  urlError ? "border-destructive" : "border-border"
                )}
              />
              {checkingCache && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {urlError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {urlError}
              </p>
            )}
          </div>

          {/* Cache banner */}
          {cacheInfo?.cached && cacheInfo.cachedAt && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs">
              <div className="flex-1 text-muted-foreground">
                Cached version available
                {cacheInfo.pagesCount !== undefined && (
                  <span className="text-foreground font-medium"> · {cacheInfo.pagesCount} pages</span>
                )}
                {" · crawled "}
                <span className="text-foreground">{timeAgo(cacheInfo.cachedAt)}</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium shrink-0">
                Cached
              </span>
            </div>
          )}

          <button
            onClick={() => {
              if (!session) { setSignInOpen(true); return; }
              setStep("options");
            }}
            disabled={!urlValid}
            className={cn(
              "flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              "bg-foreground text-background hover:opacity-90",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Step 2: Options ── */}
      {step === "options" && (
        <div className="space-y-6">
          {/* Scan Depth */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Scan Depth
            </label>
            <div className="relative">
              <select
                value={scanDepth}
                onChange={(e) => setScanDepth(Number(e.target.value) as ScanDepth)}
                className="w-full appearance-none px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:ring-1 focus:ring-ring cursor-pointer pr-8"
              >
                <option value={0}>Auto (recommended)</option>
                <option value={1}>Shallow (1 level)</option>
                <option value={3}>Medium (3 levels)</option>
                <option value={5}>Deep (5 levels)</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Detail Level */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Detail Level
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    value: "overview" as DetailLevel,
                    label: "Overview",
                    desc: "High-level structure, key pages only",
                  },
                  {
                    value: "standard" as DetailLevel,
                    label: "Standard",
                    desc: "Balanced coverage with descriptions",
                  },
                  {
                    value: "detailed" as DetailLevel,
                    label: "Detailed",
                    desc: "Comprehensive with extended descriptions",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDetailLevel(opt.value)}
                  className={cn(
                    "flex flex-col gap-1 p-3 rounded-xl border text-left transition-all",
                    detailLevel === opt.value
                      ? "border-foreground bg-foreground/5"
                      : "border-border bg-card hover:bg-accent/50"
                  )}
                >
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-snug">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File Name */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              File Name
            </label>
            <div className="flex items-center rounded-xl border border-border bg-card overflow-hidden focus-within:ring-1 focus-within:ring-ring">
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none"
                placeholder="llms"
              />
              <span className="px-3 py-2.5 text-sm text-muted-foreground bg-muted/50 border-l border-border">
                .txt
              </span>
            </div>
          </div>

          {/* Email notification */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              Email notification
              <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            />
            <p className="text-[10px] text-muted-foreground">
              Get notified when your llms.txt file is ready. You can close the page after starting.
            </p>
          </div>

          {generateError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{generateError}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep("input")}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                "bg-foreground text-background hover:opacity-90",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

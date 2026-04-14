"use client";

import { useState, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { AuthGate } from "@/components/layout/auth-gate";
import {
  useHostedSqliteDbs,
  uploadSqliteDb,
  deleteHostedSqliteDb,
  type HostedSqliteDB,
} from "@/lib/hosted-sqlite";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  Database,
  FileUp,
  Loader2,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { ApiInfoDialog } from "@/components/account/hosted-sqlite-api-dialog";

// ── Helpers ─────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function nameFromFile(filename: string): string {
  return filename.replace(/\.(sqlite3?|db3?)$/i, "");
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ── Sub-components ──────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500",
    ready: "bg-green-500",
    processing: "bg-blue-500",
    error: "bg-red-500",
  };
  const labels: Record<string, string> = {
    active: "Active",
    ready: "Active",
    processing: "Processing",
    error: "Error",
  };
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${colors[status] ?? "bg-muted-foreground"}`}
      />
      {labels[status] ?? status}
    </span>
  );
}

// ── Delete Dialog ──────────────────────────────────

function DeleteSqliteDialog({
  dbName,
  open,
  onOpenChange,
  onConfirm,
  deleting,
}: {
  dbName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (!v) setConfirmText("");
    onOpenChange(v);
  };

  const matches = confirmText === dbName;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete Database
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete{" "}
            <span className="font-semibold text-foreground">{dbName}</span> and
            all of its data. This action cannot be undone.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Type{" "}
              <span className="font-mono text-foreground">{dbName}</span> to
              confirm
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={dbName}
              className="font-mono text-sm"
              autoFocus
              disabled={deleting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={onConfirm}
              disabled={!matches || deleting}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Database Card ───────────────────────────────────

function SqliteDbCard({
  db,
  onDeleted,
}: {
  db: HostedSqliteDB;
  onDeleted: () => void;
}) {
  const [apiOpen, setApiOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteHostedSqliteDb(db.id);
      setDeleteOpen(false);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/account/sqlite/${db.id}`}
          className="flex items-center gap-3 min-w-0 flex-1 group"
        >
          <Database className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate group-hover:underline underline-offset-2">
              {db.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {formatBytes(db.fileSize)}
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(db.createdAt)}
              </span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusDot status={db.status} />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2 gap-1.5"
            onClick={() => setApiOpen(true)}
            title="API access"
          >
            <Zap className="h-3.5 w-3.5" />
            API
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
            disabled={deleting}
            title="Delete database"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      <ApiInfoDialog db={db} open={apiOpen} onOpenChange={setApiOpen} />
      <DeleteSqliteDialog
        dbName={db.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDelete()}
        deleting={deleting}
      />
    </div>
  );
}

// ── Upload Dialog ──────────────────────────────────

function UploadDialog({
  onUploaded,
}: {
  onUploaded: (db: HostedSqliteDB) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setName("");
    setError(null);
    setUploading(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    setOpen(v);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setError(`File is too large (max 50 MB, got ${formatBytes(f.size)})`);
      return;
    }
    setError(null);
    setFile(f);
    if (!name) setName(nameFromFile(f.name));
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const db = await uploadSqliteDb(file, name.trim());
      setOpen(false);
      reset();
      onUploaded(db);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Upload Database
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload SQLite Database</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* File picker */}
            <div className="space-y-1.5">
              <Label htmlFor="sqlite-file">File</Label>
              <input
                id="sqlite-file"
                ref={fileInputRef}
                type="file"
                accept=".sqlite,.db,.sqlite3,.db3"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 rounded-md border border-dashed px-4 py-3 text-sm hover:bg-accent transition-colors"
              >
                <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
                {file ? (
                  <span className="truncate font-medium">{file.name}</span>
                ) : (
                  <span className="text-muted-foreground">
                    Choose a .sqlite, .db, .sqlite3, or .db3 file (max 50 MB)
                  </span>
                )}
              </button>
            </div>

            {/* Name input */}
            <div className="space-y-1.5">
              <Label htmlFor="sqlite-name">Name</Label>
              <Input
                id="sqlite-name"
                placeholder="my-database"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleUpload();
                }}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <Button
              className="w-full gap-2"
              onClick={() => void handleUpload()}
              disabled={uploading || !file || !name.trim()}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileUp className="h-3.5 w-3.5" />
              )}
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main inner component ───────────────────────────

function HostedSqliteDashboardInner() {
  const { data: session } = useSession();
  const { data: databases, loading, error, refetch } = useHostedSqliteDbs();
  const [pendingApiDb, setPendingApiDb] = useState<HostedSqliteDB | null>(null);

  const isEmpty = !loading && !error && databases?.length === 0;

  const handleUploaded = (db: HostedSqliteDB) => {
    void refetch();
    // Show the API info dialog for the newly created DB (includes full apiKey)
    setPendingApiDb(db);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Hosted SQLite</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and host SQLite databases with a query API.
          </p>
        </div>
        {!loading && !error && <UploadDialog onUploaded={handleUploaded} />}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Failed to load databases.</span>
          <button
            className="underline underline-offset-2 hover:no-underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-lg border divide-y">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-lg border px-6 py-12 flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Database className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No databases yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a SQLite file to get a hosted database with a query API.
            </p>
          </div>
          <UploadDialog onUploaded={handleUploaded} />
        </div>
      )}

      {/* Database list */}
      {!loading && databases && databases.length > 0 && (
        <div className="rounded-lg border divide-y">
          {databases.map((db) => (
            <SqliteDbCard
              key={db.id}
              db={db}
              onDeleted={() => void refetch()}
            />
          ))}
        </div>
      )}

      {/* Post-upload API dialog */}
      {pendingApiDb && (
        <ApiInfoDialog
          db={pendingApiDb}
          open={true}
          onOpenChange={(v) => {
            if (!v) setPendingApiDb(null);
          }}
        />
      )}

      {/* Account info footer */}
      {session?.user && (
        <p className="text-xs text-muted-foreground">
          Account: <span className="font-medium">{session.user.email}</span>
        </p>
      )}
    </div>
  );
}

export function HostedSqliteDashboard() {
  return (
    <AuthGate>
      <HostedSqliteDashboardInner />
    </AuthGate>
  );
}

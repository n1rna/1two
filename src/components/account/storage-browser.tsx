"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  listObjects,
  uploadObject,
  deleteObject,
  getObjectUrl,
  getStorageUsage,
  type StorageObject,
  type StorageUsage,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Download,
  File,
  FileCode,
  FileJson,
  FileText,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFileIcon(contentType: string, key: string) {
  const ct = contentType.toLowerCase();
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (ct.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (
    ct.includes("json") ||
    ext === "json" ||
    ext === "jsonl" ||
    ext === "ndjson"
  )
    return <FileJson className="h-4 w-4" />;
  if (
    ct.includes("javascript") ||
    ct.includes("typescript") ||
    ct.includes("html") ||
    ct.includes("css") ||
    ct.includes("xml") ||
    ["js", "ts", "tsx", "jsx", "html", "css", "xml", "py", "go", "rs"].includes(
      ext
    )
  )
    return <FileCode className="h-4 w-4" />;
  if (ct.startsWith("text/") || ext === "txt" || ext === "md")
    return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

// ── Folder tree helpers ───────────────────────────────

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
}

function buildFolderTree(objects: StorageObject[]): FolderNode[] {
  const dirs = new Set<string>();
  for (const obj of objects) {
    const parts = obj.key.split("/");
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join("/") + "/");
    }
  }
  const roots: FolderNode[] = [];
  const nodes = new Map<string, FolderNode>();

  const sortedDirs = Array.from(dirs).sort();
  for (const dir of sortedDirs) {
    const name = dir.replace(/\/$/, "").split("/").pop() ?? dir;
    const node: FolderNode = { name, path: dir, children: [] };
    nodes.set(dir, node);
    const parentPath = dir
      .replace(/\/$/, "")
      .split("/")
      .slice(0, -1)
      .join("/");
    const parent = parentPath ? nodes.get(parentPath + "/") : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ── Usage Bar ─────────────────────────────────────────

function UsageBar({ usage }: { usage: StorageUsage | null }) {
  if (!usage) return null;
  const pct =
    usage.limitBytes > 0
      ? Math.min(100, (usage.usedBytes / usage.limitBytes) * 100)
      : 0;
  const color =
    pct > 80
      ? "bg-red-500"
      : pct > 50
        ? "bg-yellow-500"
        : "bg-green-500";

  return (
    <div className="space-y-1.5 px-3 py-3 border-b">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HardDrive className="h-3 w-3" />
          Storage
        </span>
        <span>
          {formatBytes(usage.usedBytes)} / {formatBytes(usage.limitBytes)}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Sidebar folder tree ───────────────────────────────

function FolderTreeNode({
  node,
  currentPath,
  onSelect,
  depth,
}: {
  node: FolderNode;
  currentPath: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(
    currentPath.startsWith(node.path) || depth === 0
  );
  const isActive = currentPath === node.path;
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        className={`flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-xs transition-colors hover:bg-accent ${
          isActive
            ? "bg-accent text-accent-foreground font-medium"
            : "text-muted-foreground"
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => {
          onSelect(node.path);
          if (hasChildren) setExpanded((v) => !v);
        }}
      >
        {hasChildren ? (
          <ChevronRight
            className={`h-3 w-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        ) : (
          <span className="h-3 w-3 shrink-0" />
        )}
        <FolderOpen className="h-3 w-3 shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.path}
              node={child}
              currentPath={currentPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────

function Breadcrumb({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (path: string) => void;
}) {
  const parts = path === "" ? [] : path.replace(/\/$/, "").split("/");

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto">
      <button
        className="hover:text-foreground shrink-0 transition-colors"
        onClick={() => onNavigate("")}
      >
        /
      </button>
      {parts.map((part, i) => {
        const partPath = parts.slice(0, i + 1).join("/") + "/";
        return (
          <span key={partPath} className="flex items-center gap-1 shrink-0">
            <ChevronRight className="h-3 w-3" />
            <button
              className="hover:text-foreground transition-colors"
              onClick={() => onNavigate(partPath)}
            >
              {part}
            </button>
          </span>
        );
      })}
    </div>
  );
}

// ── Delete confirm dialog ─────────────────────────────

function DeleteObjectDialog({
  objectKey,
  open,
  onOpenChange,
  onConfirm,
  deleting,
}: {
  objectKey: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const name = objectKey.split("/").filter(Boolean).pop() ?? objectKey;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete File
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Permanently delete{" "}
            <span className="font-mono text-foreground text-xs">{name}</span>?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={onConfirm}
              disabled={deleting}
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

// ── Upload indicator ──────────────────────────────────

interface UploadingFile {
  name: string;
  size: number;
  done: boolean;
  error?: string;
}

// ── File row (list view) ──────────────────────────────

function FileRow({
  obj,
  bucketId,
  onDeleted,
}: {
  obj: StorageObject;
  bucketId: string;
  onDeleted: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const name = obj.key.split("/").filter(Boolean).pop() ?? obj.key;

  const handleDownload = async () => {
    try {
      const url = await getObjectUrl(bucketId, obj.id);
      window.open(url, "_blank");
    } catch {
      // silently fail — no toast system referenced here
    }
  };

  const handleCopyUrl = async () => {
    setCopying(true);
    try {
      const url = await getObjectUrl(bucketId, obj.id);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    } finally {
      setCopying(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteObject(bucketId, obj.id);
      setDeleteOpen(false);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 group border-b last:border-0">
      <span className="shrink-0 text-muted-foreground">
        {getFileIcon(obj.contentType, obj.key)}
      </span>
      <span className="text-sm truncate flex-1 font-medium">{name}</span>
      <span className="text-xs text-muted-foreground w-20 text-right shrink-0 hidden sm:block">
        {formatBytes(obj.size)}
      </span>
      <span className="text-xs text-muted-foreground w-24 text-right shrink-0 hidden md:block truncate">
        {obj.contentType || "—"}
      </span>
      <span className="text-xs text-muted-foreground w-28 text-right shrink-0 hidden lg:block">
        {formatDate(obj.updatedAt)}
      </span>
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Download"
          onClick={() => void handleDownload()}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Copy URL"
          onClick={() => void handleCopyUrl()}
          disabled={copying}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          title="Delete"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <DeleteObjectDialog
        objectKey={obj.key}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDelete()}
        deleting={deleting}
      />
    </div>
  );
}

// ── Grid card ─────────────────────────────────────────

function FileCard({
  obj,
  bucketId,
  onDeleted,
}: {
  obj: StorageObject;
  bucketId: string;
  onDeleted: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const name = obj.key.split("/").filter(Boolean).pop() ?? obj.key;

  const handleDownload = async () => {
    try {
      const url = await getObjectUrl(bucketId, obj.id);
      window.open(url, "_blank");
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteObject(bucketId, obj.id);
      setDeleteOpen(false);
      onDeleted();
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="group relative flex flex-col gap-2 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-center h-12 rounded-md bg-muted text-muted-foreground">
        <span className="scale-150">{getFileIcon(obj.contentType, obj.key)}</span>
      </div>
      <p className="text-xs font-medium truncate" title={name}>
        {name}
      </p>
      <p className="text-xs text-muted-foreground">{formatBytes(obj.size)}</p>
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => void handleDownload()}
          title="Download"
        >
          <Download className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <DeleteObjectDialog
        objectKey={obj.key}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDelete()}
        deleting={deleting}
      />
    </div>
  );
}

// ── Folder row ────────────────────────────────────────

function FolderRow({
  prefix,
  onNavigate,
}: {
  prefix: string;
  onNavigate: (path: string) => void;
}) {
  const name = prefix.replace(/\/$/, "").split("/").pop() ?? prefix;
  return (
    <button
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 w-full text-left border-b last:border-0"
      onClick={() => onNavigate(prefix)}
    >
      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-sm truncate flex-1 font-medium">{name}/</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

// ── Drop zone ─────────────────────────────────────────

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

function DropZone({
  onFiles,
  uploading,
}: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg px-6 py-10 flex flex-col items-center gap-3 text-center transition-colors ${
        dragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
      ) : (
        <Upload className="h-8 w-8 text-muted-foreground" />
      )}
      <div>
        <p className="text-sm font-medium">
          {uploading ? "Uploading…" : "Drop files here"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          or{" "}
          <button
            className="underline underline-offset-2 hover:no-underline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            click to select
          </button>{" "}
          — max {formatBytes(MAX_FILE_SIZE)} per file
        </p>
      </div>
    </div>
  );
}

// ── Main browser component ─────────────────────────────

export function StorageBrowser({ bucketId }: { bucketId: string }) {
  const [currentPath, setCurrentPath] = useState("");
  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "grid">("list");
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadingFile[]>([]);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [showDropZone, setShowDropZone] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Fetch all objects (for building the sidebar tree) and the current prefix
  const fetchObjects = useCallback(async () => {
    setLoadingObjects(true);
    setError(null);
    try {
      // Fetch all objects for the folder tree
      const all = await listObjects(bucketId);
      setFolderTree(buildFolderTree(all.objects));

      // Fetch current prefix with delimiter for the main panel
      const current = await listObjects(bucketId, currentPath, "/");
      // Filter objects to only those directly in the current path (not sub-prefixes)
      const directObjects = current.objects.filter((obj) => {
        const relative = obj.key.slice(currentPath.length);
        return !relative.includes("/") && relative !== "";
      });
      setObjects(directObjects);
      setPrefixes(current.prefixes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoadingObjects(false);
    }
  }, [bucketId, currentPath]);

  const fetchUsage = useCallback(async () => {
    try {
      const u = await getStorageUsage();
      setUsage(u);
    } catch {
      // ignore usage errors
    }
  }, []);

  useEffect(() => {
    void fetchObjects();
    void fetchUsage();
  }, [fetchObjects, fetchUsage]);

  const handleFiles = async (files: File[]) => {
    const tooBig = files.filter((f) => f.size > MAX_FILE_SIZE);
    const ok = files.filter((f) => f.size <= MAX_FILE_SIZE);

    if (tooBig.length) {
      setError(
        `File${tooBig.length > 1 ? "s" : ""} too large (max ${formatBytes(MAX_FILE_SIZE)}): ${tooBig.map((f) => f.name).join(", ")}`
      );
    }

    if (!ok.length) return;

    setUploading(true);
    setShowDropZone(false);

    const queue: UploadingFile[] = ok.map((f) => ({
      name: f.name,
      size: f.size,
      done: false,
    }));
    setUploadQueue(queue);

    for (let i = 0; i < ok.length; i++) {
      const file = ok[i];
      const key = currentPath + file.name;
      try {
        await uploadObject(bucketId, file, key);
        setUploadQueue((q) =>
          q.map((item, idx) => (idx === i ? { ...item, done: true } : item))
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploadQueue((q) =>
          q.map((item, idx) => (idx === i ? { ...item, error: msg } : item))
        );
      }
    }

    setUploading(false);
    setTimeout(() => setUploadQueue([]), 2500);
    void fetchObjects();
    void fetchUsage();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    const folderKey =
      currentPath + newFolderName.trim().replace(/\/+$/, "") + "/";
    try {
      // POST a zero-byte placeholder with the folder key ending in /
      const form = new FormData();
      form.append("key", folderKey);
      const res = await fetch(
        `/api/proxy/storage/buckets/${bucketId}/objects`,
        { method: "POST", credentials: "include", body: form }
      );
      if (!res.ok) throw new Error(`Failed to create folder: ${res.status}`);
      setCreateFolderOpen(false);
      setNewFolderName("");
      void fetchObjects();
    } catch {
      // ignore — folder might already exist
    } finally {
      setCreatingFolder(false);
    }
  };

  const isEmpty = !loadingObjects && objects.length === 0 && prefixes.length === 0;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-[250px] shrink-0 flex flex-col border-r overflow-hidden">
        {/* Sidebar header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b min-h-[52px]">
          <Link
            href="/account/databases"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="text-muted-foreground/60">&larr;</span>
            All databases
          </Link>
        </div>
        {/* Bucket name */}
        <div className="px-3 py-2.5 border-b">
          <div className="flex items-center gap-2">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold truncate text-foreground">
              {bucketId}
            </span>
            <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
              Storage
            </span>
          </div>
        </div>

        {/* Usage bar */}
        <UsageBar usage={usage} />

        {/* Folder tree */}
        <div className="flex-1 overflow-y-auto py-2">
          <button
            className={`flex items-center gap-1.5 w-full text-left px-3 py-1 rounded text-xs transition-colors hover:bg-accent mb-0.5 ${
              currentPath === ""
                ? "text-accent-foreground font-medium"
                : "text-muted-foreground"
            }`}
            onClick={() => setCurrentPath("")}
          >
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span>/ (root)</span>
          </button>
          {folderTree.map((node) => (
            <FolderTreeNode
              key={node.path}
              node={node}
              currentPath={currentPath}
              onSelect={setCurrentPath}
              depth={0}
            />
          ))}
        </div>
      </aside>

      {/* Main panel */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b min-h-[52px] bg-background">
          <Breadcrumb path={currentPath} onNavigate={setCurrentPath} />
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => setCreateFolderOpen(true)}
            >
              <Plus className="h-3 w-3" />
              Folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-7 text-xs"
              onClick={() => setShowDropZone((v) => !v)}
              disabled={uploading}
            >
              <Upload className="h-3 w-3" />
              Upload
            </Button>
            <div className="flex items-center rounded-md border overflow-hidden">
              <button
                className={`h-7 w-7 flex items-center justify-center transition-colors ${
                  view === "list" ? "bg-muted" : "hover:bg-muted/50"
                }`}
                onClick={() => setView("list")}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                className={`h-7 w-7 flex items-center justify-center transition-colors ${
                  view === "grid" ? "bg-muted" : "hover:bg-muted/50"
                }`}
                onClick={() => setView("grid")}
                title="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Upload queue */}
        {uploadQueue.length > 0 && (
          <div className="px-4 py-2 bg-muted/30 border-b space-y-1">
            {uploadQueue.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {item.error ? (
                  <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                ) : item.done ? (
                  <Check className="h-3 w-3 text-green-500 shrink-0" />
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                )}
                <span className={`truncate ${item.error ? "text-destructive" : ""}`}>
                  {item.name}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {formatBytes(item.size)}
                </span>
                {item.error && (
                  <span className="text-destructive shrink-0">{item.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button className="underline underline-offset-2" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* Drop zone */}
        {showDropZone && (
          <div className="px-4 pt-4">
            <DropZone onFiles={(f) => void handleFiles(f)} uploading={uploading} />
          </div>
        )}

        {/* Content area */}
        <div
          className="flex-1 overflow-y-auto"
          onDragOver={(e) => {
            e.preventDefault();
            setShowDropZone(true);
          }}
        >
          {loadingObjects ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading files…
            </div>
          ) : isEmpty ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No files yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload files to get started.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowDropZone(true)}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload files
              </Button>
            </div>
          ) : view === "list" ? (
            <div>
              {/* List view header */}
              <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/20">
                <span className="w-4 shrink-0" />
                <span className="text-xs font-medium text-muted-foreground flex-1">
                  Name
                </span>
                <span className="text-xs font-medium text-muted-foreground w-20 text-right shrink-0 hidden sm:block">
                  Size
                </span>
                <span className="text-xs font-medium text-muted-foreground w-24 text-right shrink-0 hidden md:block">
                  Type
                </span>
                <span className="text-xs font-medium text-muted-foreground w-28 text-right shrink-0 hidden lg:block">
                  Modified
                </span>
                <span className="w-24 shrink-0" />
              </div>
              {prefixes.map((prefix) => (
                <FolderRow
                  key={prefix}
                  prefix={prefix}
                  onNavigate={setCurrentPath}
                />
              ))}
              {objects.map((obj) => (
                <FileRow
                  key={obj.id}
                  obj={obj}
                  bucketId={bucketId}
                  onDeleted={() => void fetchObjects()}
                />
              ))}
            </div>
          ) : (
            <div className="p-4">
              {prefixes.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Folders
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {prefixes.map((prefix) => {
                      const name =
                        prefix.replace(/\/$/, "").split("/").pop() ?? prefix;
                      return (
                        <button
                          key={prefix}
                          className="flex flex-col items-center gap-2 rounded-lg border p-3 hover:bg-muted/30 transition-colors text-center"
                          onClick={() => setCurrentPath(prefix)}
                        >
                          <FolderOpen className="h-8 w-8 text-muted-foreground" />
                          <span className="text-xs font-medium truncate w-full">
                            {name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {objects.length > 0 && (
                <div>
                  {prefixes.length > 0 && (
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Files
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {objects.map((obj) => (
                      <FileCard
                        key={obj.id}
                        obj={obj}
                        bucketId={bucketId}
                        onDeleted={() => void fetchObjects()}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create folder dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <FolderOpen className="h-4 w-4" />
              Create Folder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="folder-name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreateFolder();
              }}
              autoFocus
              disabled={creatingFolder}
            />
            <p className="text-xs text-muted-foreground">
              Current path:{" "}
              <span className="font-mono">
                /{currentPath}{newFolderName.trim() ? newFolderName.trim() + "/" : ""}
              </span>
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCreateFolderOpen(false);
                  setNewFolderName("");
                }}
                disabled={creatingFolder}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => void handleCreateFolder()}
                disabled={creatingFolder || !newFolderName.trim()}
              >
                {creatingFolder ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

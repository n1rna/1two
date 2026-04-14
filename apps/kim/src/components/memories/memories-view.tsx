"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Selectable } from "@/components/kim";
import {
  createLifeMemory,
  deleteLifeMemory,
  listLifeMemories,
  updateLifeMemory,
  type LifeMemory,
} from "@/lib/life";

const MEMORY_CATEGORIES = [
  { value: "preference", label: "Preference" },
  { value: "instruction", label: "Instruction" },
  { value: "fact", label: "Fact" },
  { value: "habit", label: "Habit" },
];

const CATEGORY_COLORS: Record<string, string> = {
  preference: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  instruction: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  fact: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  habit: "bg-green-500/15 text-green-600 dark:text-green-400",
};

export function MemoriesView() {
  const [memories, setMemories] = useState<LifeMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorCategory, setEditorCategory] = useState("instruction");
  const [editorDirty, setEditorDirty] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setMemories(await listLifeMemories()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  const selectMemory = useCallback((m: LifeMemory) => {
    setSelectedId(m.id);
    setEditorContent(m.content);
    setEditorCategory(m.category);
    setEditorDirty(false);
    setIsNew(false);
  }, []);

  const startNew = useCallback(() => {
    setSelectedId(`new-${Date.now()}`);
    setEditorContent("");
    setEditorCategory("instruction");
    setEditorDirty(false);
    setIsNew(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editorContent.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const m = await createLifeMemory(editorContent.trim(), editorCategory);
        setMemories((prev) => [m, ...prev]);
        setSelectedId(m.id);
        setIsNew(false);
      } else if (selectedId) {
        const u = await updateLifeMemory(selectedId, editorContent.trim(), editorCategory);
        setMemories((prev) => prev.map((m) => (m.id === u.id ? u : m)));
      }
      setEditorDirty(false);
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }, [isNew, selectedId, editorContent, editorCategory]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteLifeMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) { setSelectedId(null); setEditorContent(""); setEditorDirty(false); }
    } catch (e) { setError(String(e)); }
    finally { setConfirmDeleteId(null); }
  }, [selectedId]);

  const filtered = filterCategory === "all" ? memories : memories.filter((m) => m.category === filterCategory);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-1 flex-1 flex-wrap">
          <button onClick={() => setFilterCategory("all")} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", filterCategory === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}>All</button>
          {MEMORY_CATEGORIES.map((cat) => (
            <button key={cat.value} onClick={() => setFilterCategory(cat.value)} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", filterCategory === cat.value ? cn(CATEGORY_COLORS[cat.value] ?? "bg-muted text-foreground") : "text-muted-foreground hover:bg-muted/50")}>{cat.label}</button>
          ))}
        </div>
        <button onClick={loadMemories} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground" title="Refresh">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
        <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={startNew}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className={cn("flex flex-col overflow-hidden", selectedId || isNew ? "w-64 shrink-0 border-r" : "flex-1")}>
          {error && (
            <div className="flex items-center gap-1.5 mx-2 mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate flex-1">{error}</span>
              <button onClick={() => setError(null)}><X className="h-2.5 w-2.5" /></button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-2 space-y-1">{[...Array(6)].map((_, i) => <div key={i} className="h-8 rounded bg-muted/50 animate-pulse" />)}</div>}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <Lightbulb className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground">{filterCategory === "all" ? "No memories yet" : `No ${filterCategory} memories`}</p>
              </div>
            )}
            {!loading && filtered.map((memory) => (
              <Selectable
                key={memory.id}
                kind="memory"
                id={memory.id}
                label={memory.content.split("\n")[0] || "Empty"}
                snapshot={{ category: memory.category, content: memory.content }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => selectMemory(memory)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") selectMemory(memory); }}
                  className={cn(
                    "w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border/20 hover:bg-accent/40 transition-colors group cursor-pointer",
                    selectedId === memory.id && "bg-accent/60",
                  )}
                >
                  <span className={cn("shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase leading-none", CATEGORY_COLORS[memory.category] ?? "bg-muted text-muted-foreground")}>
                    {memory.category.slice(0, 4)}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-foreground/80">{memory.content.split("\n")[0] || "Empty"}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(memory.id); }}
                    className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </Selectable>
            ))}
          </div>
        </div>

        {(selectedId || isNew) && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
              <div className="flex items-center gap-1 flex-1 flex-wrap">
                {MEMORY_CATEGORIES.map((cat) => (
                  <button key={cat.value} onClick={() => { setEditorCategory(cat.value); setEditorDirty(true); }} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", editorCategory === cat.value ? cn(CATEGORY_COLORS[cat.value] ?? "bg-primary text-primary-foreground", "ring-1 ring-primary/30") : "bg-muted/50 text-muted-foreground hover:bg-muted")}>{cat.label}</button>
                ))}
              </div>
              <Button size="sm" className="gap-1 text-xs h-6" onClick={handleSave} disabled={!editorContent.trim() || saving || (!editorDirty && !isNew)}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {isNew ? "Create" : "Save"}
              </Button>
              <button onClick={() => { setSelectedId(null); setIsNew(false); setEditorDirty(false); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <textarea
                value={editorContent}
                onChange={(e) => { setEditorContent(e.target.value); setEditorDirty(true); }}
                placeholder="Write your memory in markdown..."
                className="w-full h-full resize-none bg-background px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none placeholder:text-muted-foreground/40"
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); } }}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-1 border-t text-[10px] text-muted-foreground/50 shrink-0">
              <span>{editorContent.length} chars</span>
              <span>{editorContent.split("\n").length} lines</span>
              {editorDirty && <span className="text-amber-500">unsaved</span>}
              {!editorDirty && !isNew && <span className="text-green-500">saved</span>}
              <span className="ml-auto">Cmd+S to save</span>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Memory</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

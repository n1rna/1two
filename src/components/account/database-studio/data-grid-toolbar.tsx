"use client";

import { Plus, Trash2, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DataGridToolbarProps {
  hasChanges: boolean;
  changeCount: number;
  selectedCount: number;
  saving: boolean;
  onAddRow: () => void;
  onDeleteSelected: () => void;
  onSave: () => void;
  onDiscard: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function DataGridToolbar({
  hasChanges,
  changeCount,
  selectedCount,
  saving,
  onAddRow,
  onDeleteSelected,
  onSave,
  onDiscard,
  className,
  children,
}: DataGridToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 border-b bg-muted/10 shrink-0",
        className
      )}
    >
      {/* Left: row actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={onAddRow}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Row
        </Button>
        {selectedCount > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onDeleteSelected}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete {selectedCount > 1 ? `${selectedCount} rows` : "Row"}
          </Button>
        )}
        {children}
      </div>

      <div className="flex-1" />

      {/* Right: pending changes */}
      {hasChanges && (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="h-6 text-xs font-normal text-amber-600 border-amber-500/30 bg-amber-500/10"
          >
            {changeCount} {changeCount === 1 ? "change" : "changes"}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onDiscard}
            disabled={saving}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Discard
          </Button>
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}

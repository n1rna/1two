"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Copy,
  Check,
  X,
  Sun,
  Moon,
  Droplets,
  Pipette,
  RotateCcw,
  RotateCw,
  Save,
} from "lucide-react";
import {
  SVPicker,
  HueSlider,
  OpacitySlider,
  COLOR_PICKER_SLIDER_STYLES,
} from "@/components/ui/color-picker";
import {
  type HSVA,
  type SavedColor,
  hsvaToRgba,
  rgbaToHsva,
  hsvaToHsla,
  rgbaToOklch,
  formatHex,
  formatRgb,
  formatHsl,
  formatOklch,
  parseHex,
  quantizeRgba,
  adjustLightness,
  adjustSaturation,
  shiftHue,
  hsvaTocss,
  loadSavedColors,
  saveSavedColors,
} from "@/lib/tools/color";

// ── Helpers ────────────────────────────────────────────

function checkerboard() {
  return `repeating-conic-gradient(rgba(128,128,128,0.15) 0% 25%, transparent 0% 50%) 0 0 / 8px 8px`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      onMouseDown={(e) => e.preventDefault()}
      className="p-1 rounded hover:bg-muted transition-colors shrink-0"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}

function FormatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-12 shrink-0 font-medium">
        {label}
      </span>
      <code className="flex-1 min-w-0 truncate font-mono bg-muted px-2 py-1 rounded text-[11px]">
        {value}
      </code>
      <CopyBtn text={value} />
    </div>
  );
}

// ── ColorBuilderSheet ──────────────────────────────────

export interface ColorBuilderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current hex color */
  value: string;
  /** Called with hex string when color changes */
  onChange: (hex: string) => void;
  title?: string;
  description?: string;
  /** Optional extra content rendered above the adjustments */
  children?: React.ReactNode;
}

export function ColorBuilderSheet({
  open,
  onOpenChange,
  value,
  onChange,
  title = "Color Builder",
  description = "Build and save colors.",
  children,
}: ColorBuilderSheetProps) {
  const [hsva, setHsva] = useState<HSVA>(() => {
    const parsed = parseHex(value);
    return parsed ? rgbaToHsva(parsed) : { h: 210, s: 0.8, v: 0.9, a: 1 };
  });
  const [hexInput, setHexInput] = useState(value);
  const [savedColors, setSavedColors] = useState<SavedColor[]>([]);
  const lastEmittedHex = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Load saved colors on mount
  useEffect(() => {
    setSavedColors(loadSavedColors());
  }, []);

  // Sync from external value (skip if it matches what we last emitted)
  useEffect(() => {
    if (value.toLowerCase() === lastEmittedHex.current.toLowerCase()) return;
    lastEmittedHex.current = value;
    const parsed = parseHex(value);
    if (parsed) {
      setHsva(rgbaToHsva(parsed));
      setHexInput(value);
    }
  }, [value]);

  // Update hsva and emit hex to parent
  const updateHsva = useCallback((next: HSVA) => {
    setHsva(next);
    const hex = formatHex(hsvaToRgba(next));
    setHexInput(hex);
    lastEmittedHex.current = hex;
    onChangeRef.current(hex);
  }, []);

  const handleHexCommit = useCallback(() => {
    const parsed = parseHex(hexInput);
    if (parsed) {
      updateHsva(rgbaToHsva(parsed));
    } else {
      setHexInput(formatHex(hsvaToRgba(hsva)));
    }
  }, [hexInput, hsva, updateHsva]);

  const handleSaveColor = useCallback(() => {
    const color: SavedColor = {
      id: crypto.randomUUID(),
      hsva,
      name: formatHex(hsvaToRgba(hsva)),
    };
    const updated = [...savedColors, color];
    setSavedColors(updated);
    saveSavedColors(updated);
  }, [hsva, savedColors]);

  const handleDeleteColor = useCallback(
    (id: string) => {
      const updated = savedColors.filter((c) => c.id !== id);
      setSavedColors(updated);
      saveSavedColors(updated);
    },
    [savedColors]
  );

  const rawRgba = hsvaToRgba(hsva);
  const rgba = quantizeRgba(rawRgba, 8);
  const hsla = hsvaToHsla(hsva);
  const oklch = rgbaToOklch(rgba);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-sm">{title}</SheetTitle>
          <SheetDescription className="text-xs">{description}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-4">
          {children}

          <SVPicker
            hsva={hsva}
            onChange={(s, v) => updateHsva({ ...hsva, s, v })}
          />
          <HueSlider
            hue={hsva.h}
            onChange={(h) => updateHsva({ ...hsva, h })}
          />
          <OpacitySlider
            hsva={hsva}
            onChange={(a) => updateHsva({ ...hsva, a })}
          />

          {/* Hex input */}
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-md border border-border/50 shrink-0 relative overflow-hidden"
              style={{ background: checkerboard() }}
            >
              <div
                className="absolute inset-0"
                style={{ background: hsvaTocss(hsva) }}
              />
            </div>
            <Input
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={handleHexCommit}
              onKeyDown={(e) => e.key === "Enter" && handleHexCommit()}
              className="font-mono text-sm h-8 flex-1"
              spellCheck={false}
            />
          </div>

          {/* Formats */}
          <div className="space-y-1.5">
            <FormatRow label="HEX" value={formatHex(rgba)} />
            <FormatRow label="RGB" value={formatRgb(rgba)} />
            <FormatRow label="HSL" value={formatHsl(hsla)} />
            <FormatRow label="OKLCH" value={formatOklch(oklch)} />
          </div>

          <Separator />

          {/* Adjust */}
          <div className="space-y-2">
            <span className="text-xs font-medium">Adjust</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                {
                  label: "Lighter",
                  icon: Sun,
                  fn: () => updateHsva(adjustLightness(hsva, 0.05)),
                },
                {
                  label: "Darker",
                  icon: Moon,
                  fn: () => updateHsva(adjustLightness(hsva, -0.05)),
                },
                {
                  label: "Saturate",
                  icon: Droplets,
                  fn: () => updateHsva(adjustSaturation(hsva, 0.1)),
                },
                {
                  label: "Desaturate",
                  icon: Pipette,
                  fn: () => updateHsva(adjustSaturation(hsva, -0.1)),
                },
                {
                  label: "Hue +15",
                  icon: RotateCw,
                  fn: () => updateHsva(shiftHue(hsva, 15)),
                },
                {
                  label: "Hue -15",
                  icon: RotateCcw,
                  fn: () => updateHsva(shiftHue(hsva, -15)),
                },
              ].map((b) => (
                <Button
                  key={b.label}
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs justify-start"
                  onClick={b.fn}
                >
                  <b.icon className="h-3 w-3 mr-1.5" /> {b.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs"
              onClick={handleSaveColor}
            >
              <Save className="h-3 w-3 mr-1" /> Save Color
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => onOpenChange(false)}
            >
              <Check className="h-3 w-3 mr-1" /> Apply
            </Button>
          </div>

          {/* Saved colors */}
          {savedColors.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <span className="text-xs font-medium">Saved Colors</span>
                <div className="flex flex-wrap gap-1.5">
                  {savedColors.map((sc) => (
                    <div key={sc.id} className="relative group">
                      <button
                        className="w-8 h-8 rounded-md border border-border/50 relative overflow-hidden hover:ring-2 hover:ring-ring/50"
                        onClick={() => updateHsva(sc.hsva)}
                        style={{ background: checkerboard() }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{ background: hsvaTocss(sc.hsva) }}
                        />
                      </button>
                      <button
                        onClick={() => handleDeleteColor(sc.id)}
                        className="absolute -top-1 -right-1 p-0.5 bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2 w-2 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>

      <style>{COLOR_PICKER_SLIDER_STYLES}</style>
    </Sheet>
  );
}

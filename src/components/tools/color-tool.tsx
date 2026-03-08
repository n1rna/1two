"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  RefreshCw,
  Save,
  RotateCcw,
  RotateCw,
  Palette,
  Paintbrush,
  ChevronDown,
  Trash2,
  DollarSign,
  Users,
  CreditCard,
  Activity,
} from "lucide-react";
import {
  type HSVA,
  type ThemeTokens,
  type ThemeTokenKey,
  type SavedColor,
  type SavedTheme,
  type HarmonyType,
  THEME_PRESETS,
  THEME_TOKEN_META,
  CORE_TOKENS,
  HARMONY_TYPES,
  THEME_TOKEN_KEYS,
  generateThemeTokens,
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
  contrastTextHex,
  drawSVCanvas,
  hsvaTocss,
  hsvaToSolidCss,
  loadSavedColors,
  saveSavedColors,
  loadSavedThemes,
  saveSavedThemes,
  themeTokensToCssVars,
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
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

function FormatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-12 shrink-0 font-medium">{label}</span>
      <code className="flex-1 min-w-0 truncate font-mono bg-muted px-2 py-1 rounded text-[11px]">{value}</code>
      <CopyBtn text={value} />
    </div>
  );
}

// ── SV Picker ──────────────────────────────────────────

function SVPicker({ hsva, onChange }: { hsva: HSVA; onChange: (s: number, v: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawSVCanvas(ctx, hsva.h, canvas.width, canvas.height);
  }, [hsva.h]);

  const pick = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      onChange(
        Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
        Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
      );
    },
    [onChange]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square rounded-lg overflow-hidden cursor-crosshair border border-border/50"
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        pick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => dragging.current && pick(e.clientX, e.clientY)}
      onPointerUp={() => { dragging.current = false; }}
    >
      <canvas ref={canvasRef} width={256} height={256} className="w-full h-full" />
      <div
        className="absolute w-4 h-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] pointer-events-none -translate-x-1/2 -translate-y-1/2"
        style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%` }}
      />
    </div>
  );
}

// ── Sliders ────────────────────────────────────────────

function HueSlider({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Hue</span>
        <span className="text-xs font-mono tabular-nums">{Math.round(hue)}</span>
      </div>
      <input
        type="range" min={0} max={360} step={1} value={hue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="color-slider w-full h-3 rounded-lg appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))` }}
      />
    </div>
  );
}

function OpacitySlider({ hsva, onChange }: { hsva: HSVA; onChange: (a: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Opacity</span>
        <span className="text-xs font-mono tabular-nums">{Math.round(hsva.a * 100)}%</span>
      </div>
      <div className="relative h-3 rounded-lg overflow-hidden" style={{ background: checkerboard() }}>
        <input
          type="range" min={0} max={100} step={1} value={Math.round(hsva.a * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="color-slider absolute inset-0 w-full h-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, transparent, ${hsvaToSolidCss(hsva)})` }}
        />
      </div>
    </div>
  );
}

// ── Dashboard Preview ──────────────────────────────────

function DashboardPreview({ tokens }: { tokens: ThemeTokens }) {
  const cssVars = useMemo(() => themeTokensToCssVars(tokens), [tokens]);

  const barHeights = [35, 58, 42, 78, 50, 68, 45, 85, 62, 72, 48, 90];

  const tableData = [
    { id: "INV-001", status: "Paid", method: "Credit Card", amount: "$316.00", statusColor: "var(--primary)" },
    { id: "INV-002", status: "Pending", method: "PayPal", amount: "$242.00", statusColor: "var(--accent-foreground)" },
    { id: "INV-003", status: "Failed", method: "Bank Transfer", amount: "$837.00", statusColor: "var(--destructive)" },
    { id: "INV-004", status: "Paid", method: "Credit Card", amount: "$721.00", statusColor: "var(--primary)" },
    { id: "INV-005", status: "Processing", method: "Stripe", amount: "$154.00", statusColor: "var(--muted-foreground)" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4 rounded-xl p-4" style={{ ...cssVars, background: "var(--background)", color: "var(--foreground)" }}>
      {/* Nav */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
          <div className="flex items-center gap-4">
            <span className="font-bold text-sm">Acme Inc</span>
            <div className="hidden sm:flex items-center gap-3 text-xs opacity-80">
              <span>Overview</span><span>Customers</span><span>Products</span><span>Settings</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-32 rounded-md hidden sm:block" style={{ background: "rgba(255,255,255,0.1)" }} />
            <div className="w-7 h-7 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
          </div>
        </div>
      </div>

      {/* Stat cards — alternate between card, secondary, accent, muted backgrounds */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { title: "Total Revenue", val: "$45,231.89", sub: "+20.1% from last month", icon: DollarSign, bg: "var(--card)", fg: "var(--card-foreground)" },
          { title: "Subscriptions", val: "+2,350", sub: "+180.1% from last month", icon: Users, bg: "var(--secondary)", fg: "var(--secondary-foreground)" },
          { title: "Sales", val: "+12,234", sub: "+19% from last month", icon: CreditCard, bg: "var(--accent)", fg: "var(--accent-foreground)" },
          { title: "Active Now", val: "+573", sub: "+201 since last hour", icon: Activity, bg: "var(--muted)", fg: "var(--foreground)" },
        ].map((s) => (
          <div key={s.title} className="rounded-lg p-4" style={{ background: s.bg, color: s.fg, border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ opacity: 0.6 }}>{s.title}</span>
              <s.icon className="h-4 w-4" style={{ opacity: 0.5 }} />
            </div>
            <div className="text-xl font-bold">{s.val}</div>
            <p className="text-[11px] mt-0.5" style={{ opacity: 0.6 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
        <div className="rounded-lg p-4" style={{ background: "var(--card)", color: "var(--card-foreground)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-semibold mb-1">Overview</div>
          <p className="text-[11px] mb-4" style={{ color: "var(--muted-foreground)" }}>Monthly revenue breakdown</p>
          <div className="flex items-end gap-[5px] h-36">
            {barHeights.map((h, i) => (
              <div key={i} className="flex-1 flex items-end gap-px">
                <div className="flex-1 rounded-t" style={{ height: `${h}%`, background: "var(--primary)", opacity: 0.85 }} />
                <div className="flex-1 rounded-t" style={{ height: `${Math.max(10, h * 0.65)}%`, background: "var(--accent)", opacity: 0.9 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[9px]" style={{ color: "var(--muted-foreground)" }}>
            {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: "var(--secondary)", color: "var(--secondary-foreground)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-semibold mb-1">Recent Sales</div>
          <p className="text-[11px] mb-3" style={{ opacity: 0.6 }}>You made 265 sales this month.</p>
          <div className="space-y-3">
            {[
              { name: "Olivia Martin", email: "olivia@email.com", amount: "+$1,999.00" },
              { name: "Jackson Lee", email: "jackson@email.com", amount: "+$39.00" },
              { name: "Isabella Nguyen", email: "isabella@email.com", amount: "+$299.00" },
              { name: "William Kim", email: "will@email.com", amount: "+$99.00" },
              { name: "Sofia Davis", email: "sofia@email.com", amount: "+$39.00" },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  {p.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{p.name}</div>
                  <div className="text-[10px] truncate" style={{ opacity: 0.5 }}>{p.email}</div>
                </div>
                <span className="text-xs font-semibold shrink-0">{p.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", color: "var(--card-foreground)", border: "1px solid var(--border)" }}>
        <div className="p-4 pb-2">
          <div className="text-sm font-semibold">Recent Transactions</div>
          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Manage your invoices and payments.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "var(--muted)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                <th className="text-left font-medium px-4 py-2">Invoice</th>
                <th className="text-left font-medium px-4 py-2">Status</th>
                <th className="text-left font-medium px-4 py-2 hidden sm:table-cell">Method</th>
                <th className="text-right font-medium px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={row.id} style={{ background: i % 2 === 1 ? "var(--muted)" : "transparent", borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-2.5 font-medium">{row.id}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "var(--accent)", color: row.statusColor }}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 hidden sm:table-cell" style={{ color: "var(--muted-foreground)" }}>{row.method}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg p-4" style={{ background: "var(--accent)", color: "var(--accent-foreground)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-semibold mb-1">Team Members</div>
          <p className="text-[11px] mb-3" style={{ opacity: 0.6 }}>Invite and manage your team.</p>
          <div className="space-y-3">
            {[
              { name: "Sofia Davis", email: "m@example.com", role: "Owner" },
              { name: "Jackson Lee", email: "p@example.com", role: "Member" },
              { name: "Liam Johnson", email: "l@example.com", role: "Member" },
            ].map((m) => (
              <div key={m.email} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  {m.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">{m.name}</div>
                  <div className="text-[10px]" style={{ opacity: 0.5 }}>{m.email}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--card)", color: "var(--card-foreground)" }}>{m.role}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: "var(--card)", color: "var(--card-foreground)", border: "1px solid var(--border)" }}>
          <div className="text-sm font-semibold mb-1">Create Account</div>
          <p className="text-[11px] mb-3" style={{ color: "var(--muted-foreground)" }}>Enter details to create your account.</p>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] mb-1 block" style={{ color: "var(--muted-foreground)" }}>First name</label>
                <div className="h-8 rounded-md px-2 flex items-center text-xs" style={{ background: "var(--muted)", border: "1px solid var(--input)", color: "var(--foreground)" }}>Pedro</div>
              </div>
              <div>
                <label className="text-[10px] mb-1 block" style={{ color: "var(--muted-foreground)" }}>Last name</label>
                <div className="h-8 rounded-md px-2 flex items-center text-xs" style={{ background: "var(--muted)", border: "1px solid var(--input)", color: "var(--foreground)" }}>Duarte</div>
              </div>
            </div>
            <div>
              <label className="text-[10px] mb-1 block" style={{ color: "var(--muted-foreground)" }}>Email</label>
              <div className="h-8 rounded-md px-2 flex items-center text-xs" style={{ background: "var(--muted)", border: "1px solid var(--input)", color: "var(--foreground)" }}>m@example.com</div>
            </div>
            <div className="flex gap-2 pt-1">
              <button className="flex-1 h-8 rounded-md text-xs font-medium" style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}>Cancel</button>
              <button className="flex-1 h-8 rounded-md text-xs font-medium" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>Create</button>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs" style={{ background: "var(--accent)", borderLeft: "3px solid var(--ring)" }}>
          <span className="font-medium" style={{ color: "var(--accent-foreground)" }}>Info</span>
          <span style={{ color: "var(--muted-foreground)" }}>Your changes have been saved.</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs" style={{ background: "var(--secondary)", borderLeft: "3px solid var(--destructive)" }}>
          <span className="font-medium" style={{ color: "var(--destructive)" }}>Error</span>
          <span style={{ color: "var(--secondary-foreground)", opacity: 0.7 }}>Payment method was declined.</span>
        </div>
      </div>

      {/* Components showcase */}
      <div className="rounded-lg p-4 space-y-3" style={{ background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
        <div className="text-sm font-semibold">Components</div>
        <div className="flex gap-2 flex-wrap">
          <button className="h-8 px-4 rounded-md text-xs font-medium" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>Primary</button>
          <button className="h-8 px-4 rounded-md text-xs font-medium" style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}>Secondary</button>
          <button className="h-8 px-4 rounded-md text-xs font-medium" style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}>Accent</button>
          <button className="h-8 px-4 rounded-md text-xs font-medium" style={{ background: "var(--destructive)", color: "var(--destructive-foreground)" }}>Destructive</button>
          <button className="h-8 px-4 rounded-md text-xs font-medium" style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)" }}>Outline</button>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
          <div className="flex gap-1.5 flex-wrap">
            {CORE_TOKENS.map((key) => {
              const meta = THEME_TOKEN_META.find((m) => m.key === key);
              return (
                <span key={key} className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: tokens[key], color: contrastTextHex(tokens[key]) }}>
                  {meta?.label || key}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export function ColorTool() {
  const [hsva, setHsva] = useState<HSVA>({ h: 210, s: 0.8, v: 0.9, a: 1 });
  const [bitDepth, setBitDepth] = useState(8);
  const [hexInput, setHexInput] = useState("");
  const [savedColors, setSavedColors] = useState<SavedColor[]>([]);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
  const [harmony, setHarmony] = useState<HarmonyType>("analogous");
  const [tokens, setTokens] = useState<ThemeTokens>(() => THEME_PRESETS[0].dark);
  const [editingToken, setEditingToken] = useState<ThemeTokenKey | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([]);
  const [themesDropdown, setThemesDropdown] = useState(false);
  const [presetsDropdown, setPresetsDropdown] = useState(false);
  const [mounted, setMounted] = useState(false);
  const selectingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    setSavedColors(loadSavedColors());
    setSavedThemes(loadSavedThemes());
  }, []);

  useEffect(() => {
    setHexInput(formatHex(hsvaToRgba(hsva)));
  }, [hsva]);

  // Sync picker changes to the editing token
  useEffect(() => {
    if (editingToken === null || selectingRef.current) {
      selectingRef.current = false;
      return;
    }
    const hex = formatHex(hsvaToRgba(hsva));
    setTokens((prev) => ({ ...prev, [editingToken]: hex }));
  }, [hsva, editingToken]);

  const rawRgba = hsvaToRgba(hsva);
  const rgba = quantizeRgba(rawRgba, bitDepth);
  const hsla = hsvaToHsla(hsva);
  const oklch = rgbaToOklch(rgba);

  const handleHexCommit = useCallback(() => {
    const parsed = parseHex(hexInput);
    if (parsed) setHsva(rgbaToHsva(parsed));
  }, [hexInput]);

  const handleEditToken = useCallback(
    (key: ThemeTokenKey) => {
      selectingRef.current = true;
      setEditingToken(key);
      const parsed = parseHex(tokens[key]);
      if (parsed) setHsva(rgbaToHsva(parsed));
      setBuilderOpen(true);
    },
    [tokens]
  );

  const handleCloseBuilder = useCallback((open: boolean) => {
    setBuilderOpen(open);
    if (!open) setEditingToken(null);
  }, []);

  const handleSaveColor = useCallback(() => {
    const color: SavedColor = { id: crypto.randomUUID(), hsva, name: formatHex(hsvaToRgba(hsva)) };
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

  const handleApplySaved = useCallback(
    (saved: HSVA) => {
      if (editingToken === null) return;
      selectingRef.current = true;
      setHsva(saved);
      const hex = formatHex(hsvaToRgba(saved));
      setTokens((prev) => ({ ...prev, [editingToken]: hex }));
    },
    [editingToken]
  );

  const handleLoadPreset = useCallback(
    (presetId: string) => {
      const preset = THEME_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      setTokens(themeMode === "dark" ? preset.dark : preset.light);
      setEditingToken(null);
      setBuilderOpen(false);
      setPresetsDropdown(false);
    },
    [themeMode]
  );

  const handleToggleMode = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      // Try to find matching preset and swap modes
      const currentPreset = THEME_PRESETS.find((p) =>
        JSON.stringify(prev === "light" ? p.light : p.dark) === JSON.stringify(tokens)
      );
      if (currentPreset) {
        setTokens(next === "light" ? currentPreset.light : currentPreset.dark);
      } else {
        // Re-generate derived tokens for the new mode, keeping the primary
        setTokens((prev) => {
          const generated = generateThemeTokens(prev.primary, next, harmony);
          // Keep user-set core tokens, re-derive everything else
          return { ...generated, primary: prev.primary };
        });
      }
      return next;
    });
  }, [tokens, harmony]);

  const handleGenerate = useCallback(() => {
    // Random primary color, generate full theme
    const h = Math.random() * 360;
    const s = 0.5 + Math.random() * 0.4;
    const v = 0.6 + Math.random() * 0.3;
    const rgba = hsvaToRgba({ h, s, v, a: 1 });
    const hex = formatHex(rgba);
    setTokens(generateThemeTokens(hex, themeMode, harmony));
    setHsva({ h, s, v, a: 1 });
  }, [themeMode, harmony]);

  const handleSaveTheme = useCallback(() => {
    const theme: SavedTheme = {
      id: crypto.randomUUID(),
      name: `Theme ${savedThemes.length + 1}`,
      tokens: { ...tokens },
      mode: themeMode,
    };
    const updated = [...savedThemes, theme];
    setSavedThemes(updated);
    saveSavedThemes(updated);
  }, [tokens, themeMode, savedThemes]);

  const handleLoadTheme = useCallback((theme: SavedTheme) => {
    setTokens(theme.tokens);
    setThemeMode(theme.mode);
    setEditingToken(null);
    setBuilderOpen(false);
    setThemesDropdown(false);
  }, []);

  const handleDeleteTheme = useCallback(
    (id: string) => {
      const updated = savedThemes.filter((t) => t.id !== id);
      setSavedThemes(updated);
      saveSavedThemes(updated);
    },
    [savedThemes]
  );

  const handleCopyCSS = useCallback(async () => {
    const lines = THEME_TOKEN_KEYS.map((key) => `  --${key}: ${tokens[key]};`);
    const css = `:root {\n${lines.join("\n")}\n}`;
    await navigator.clipboard.writeText(css);
  }, [tokens]);

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b shrink-0 flex-wrap">
        <div className="flex items-center gap-2 mr-1">
          <Palette className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold hidden sm:inline">Theme</span>
        </div>

        {/* Core token swatches */}
        <div className="flex items-center gap-1">
          {CORE_TOKENS.map((key) => {
            const meta = THEME_TOKEN_META.find((m) => m.key === key);
            return (
              <div key={key} className="relative group/swatch w-7 h-7 shrink-0">
                <button
                  onClick={() => handleEditToken(key)}
                  className={`relative w-7 h-7 rounded-md border overflow-hidden transition-all ${editingToken === key ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : "border-border/50 hover:scale-110"}`}
                  title={meta?.label}
                >
                  <div className="absolute inset-0" style={{ background: tokens[key] }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold" style={{ color: contrastTextHex(tokens[key]) }}>
                    {(meta?.label || key).slice(0, 3).toUpperCase()}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <Separator orientation="vertical" className="h-5 hidden sm:block" />

        {/* Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Harmony type */}
          <Select value={harmony} onValueChange={(v) => v && setHarmony(v as HarmonyType)}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HARMONY_TYPES.map((h) => (
                <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Generate */}
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleGenerate} title="Generate theme from primary color">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {/* Mode toggle */}
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleToggleMode} title={themeMode === "light" ? "Switch to dark" : "Switch to light"}>
            {themeMode === "dark" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </Button>

          {/* Presets dropdown */}
          <div className="relative">
            <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setPresetsDropdown((v) => !v)}>
              Presets <ChevronDown className="h-3 w-3" />
            </Button>
            {presetsDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPresetsDropdown(false)} />
                <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border bg-popover p-2 shadow-lg space-y-1 max-h-80 overflow-auto">
                  {THEME_PRESETS.map((preset) => {
                    const t = themeMode === "dark" ? preset.dark : preset.light;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handleLoadPreset(preset.id)}
                        className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted transition-colors"
                      >
                        <div className="flex gap-0.5 shrink-0">
                          {(["background", "primary", "secondary", "accent", "destructive"] as const).map((k) => (
                            <div key={k} className="w-4 h-4 rounded-sm" style={{ background: t[k], border: "1px solid rgba(0,0,0,0.1)" }} />
                          ))}
                        </div>
                        <span className="text-xs text-left">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleSaveTheme} title="Save theme">
            <Save className="h-3.5 w-3.5" />
          </Button>

          <Button variant="outline" size="sm" className="h-7 px-2" onClick={handleCopyCSS} title="Copy CSS variables">
            <Copy className="h-3.5 w-3.5" />
          </Button>

          {savedThemes.length > 0 && (
            <div className="relative">
              <Button variant="outline" size="sm" className="h-7 px-2 gap-1 text-xs" onClick={() => setThemesDropdown((v) => !v)}>
                Saved <ChevronDown className="h-3 w-3" />
              </Button>
              {themesDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setThemesDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border bg-popover p-2 shadow-lg space-y-1">
                    {savedThemes.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted">
                        <div className="flex gap-0.5 flex-1 min-w-0 cursor-pointer" onClick={() => handleLoadTheme(t)}>
                          {(["primary", "secondary", "accent", "destructive"] as const).map((k) => (
                            <div key={k} className="w-4 h-4 rounded-sm shrink-0" style={{ background: t.tokens[k] }} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate max-w-16">{t.name}</span>
                        <button onClick={() => handleDeleteTheme(t.id)} className="p-0.5 hover:bg-muted rounded">
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="ml-auto">
          <Button size="sm" className="h-7 px-3 gap-1.5 text-xs" onClick={() => { setEditingToken(null); setBuilderOpen(true); }}>
            <Paintbrush className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Color Builder</span>
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-0 overflow-auto p-4 bg-background">
        <DashboardPreview tokens={tokens} />
      </div>

      {/* Color Builder Sheet */}
      <Sheet open={builderOpen} onOpenChange={handleCloseBuilder}>
        <SheetContent side="right" className="sm:max-w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-sm">
              {editingToken !== null
                ? `Editing — ${THEME_TOKEN_META.find((m) => m.key === editingToken)?.label || editingToken}`
                : "Color Builder"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {editingToken !== null
                ? "Changes apply to the selected theme token."
                : "Build and save colors for your theme."}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-4">
            {/* Token selector */}
            {editingToken !== null && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md border border-border/50 shrink-0" style={{ background: tokens[editingToken] }} />
                <Select value={editingToken} onValueChange={(v) => v && handleEditToken(v as ThemeTokenKey)}>
                  <SelectTrigger size="sm" className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {THEME_TOKEN_KEYS.map((key) => {
                      const meta = THEME_TOKEN_META.find((m) => m.key === key);
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: tokens[key], border: "1px solid rgba(0,0,0,0.1)" }} />
                            <span>{meta?.label || key}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <SVPicker hsva={hsva} onChange={(s, v) => setHsva((p) => ({ ...p, s, v }))} />
            <HueSlider hue={hsva.h} onChange={(h) => setHsva((p) => ({ ...p, h }))} />
            <OpacitySlider hsva={hsva} onChange={(a) => setHsva((p) => ({ ...p, a }))} />

            {/* Hex + Bit depth */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-md border border-border/50 shrink-0 relative overflow-hidden" style={{ background: checkerboard() }}>
                <div className="absolute inset-0" style={{ background: hsvaTocss(hsva) }} />
              </div>
              <Input
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onBlur={handleHexCommit}
                onKeyDown={(e) => e.key === "Enter" && handleHexCommit()}
                className="font-mono text-sm h-8 flex-1"
                spellCheck={false}
              />
              <Select value={String(bitDepth)} onValueChange={(v) => v && setBitDepth(Number(v))}>
                <SelectTrigger size="sm" className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 8, 10, 12, 16].map((b) => (
                    <SelectItem key={b} value={String(b)}>{b}-bit</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  { label: "Lighter", icon: Sun, fn: () => setHsva(adjustLightness(hsva, 0.05)) },
                  { label: "Darker", icon: Moon, fn: () => setHsva(adjustLightness(hsva, -0.05)) },
                  { label: "Saturate", icon: Droplets, fn: () => setHsva(adjustSaturation(hsva, 0.1)) },
                  { label: "Desaturate", icon: Pipette, fn: () => setHsva(adjustSaturation(hsva, -0.1)) },
                  { label: "Hue +15", icon: RotateCw, fn: () => setHsva(shiftHue(hsva, 15)) },
                  { label: "Hue -15", icon: RotateCcw, fn: () => setHsva(shiftHue(hsva, -15)) },
                ].map((b) => (
                  <Button key={b.label} variant="outline" size="sm" className="h-7 px-2 text-xs justify-start" onClick={b.fn}>
                    <b.icon className="h-3 w-3 mr-1.5" /> {b.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleSaveColor}>
                <Save className="h-3 w-3 mr-1" /> Save Color
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                const hex = formatHex(hsvaToRgba(hsva));
                setTokens(generateThemeTokens(hex, themeMode, harmony));
              }} title="Generate theme from this color">
                <Palette className="h-3 w-3 mr-1" /> Generate Theme
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
                          onClick={() => {
                            if (editingToken !== null) {
                              handleApplySaved(sc.hsva);
                            } else {
                              selectingRef.current = true;
                              setHsva(sc.hsva);
                            }
                          }}
                          style={{ background: checkerboard() }}
                        >
                          <div className="absolute inset-0" style={{ background: hsvaTocss(sc.hsva) }} />
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
      </Sheet>

      {/* Slider styles */}
      <style>{`
        .color-slider {
          -webkit-appearance: none;
          appearance: none;
          outline: none;
          border-radius: 0.5rem;
        }
        .color-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          border: 2px solid rgba(0,0,0,0.3);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          cursor: pointer;
        }
        .color-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: white;
          border: 2px solid rgba(0,0,0,0.3);
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          cursor: pointer;
        }
        .color-slider::-moz-range-track {
          background: transparent;
          border: none;
        }
      `}</style>
    </div>
  );
}

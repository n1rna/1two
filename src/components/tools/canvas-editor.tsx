"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import {
  MousePointer2,
  Type,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  ImagePlus,
  Paintbrush,
  Undo2,
  Redo2,
  ZoomIn,
  Download,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  PenTool,
  ChevronDown,
  Maximize2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ToolMode =
  | "select"
  | "text"
  | "rect"
  | "circle"
  | "line"
  | "arrow"
  | "image";

interface CanvasObject {
  id: string;
  type: "rect" | "circle" | "line" | "arrow" | "text" | "image";
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  // Text
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  textFill?: string;
  // Image
  imageSrc?: string;
  // Line/Arrow
  points?: number[];
  name: string;
}

interface HistoryEntry {
  objects: CanvasObject[];
  background: string;
}

// ─── Konva dynamic types (loaded at runtime) ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KonvaLib = any;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}

const FONT_FAMILIES = [
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "Impact",
  "Comic Sans MS",
];

const DEFAULT_FILL = "#4f8ef7";
const DEFAULT_STROKE = "#1a1a2e";
const DEFAULT_STROKE_WIDTH = 2;

function defaultObject(
  type: CanvasObject["type"],
  x: number,
  y: number
): CanvasObject {
  const base = {
    id: genId(),
    x,
    y,
    rotation: 0,
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    opacity: 1,
    visible: true,
    locked: false,
  };
  switch (type) {
    case "rect":
      return {
        ...base,
        type: "rect",
        width: 200,
        height: 150,
        fill: DEFAULT_FILL,
        name: "Rectangle",
      };
    case "circle":
      return {
        ...base,
        type: "circle",
        width: 150,
        height: 150,
        fill: DEFAULT_FILL,
        name: "Circle",
      };
    case "line":
      return {
        ...base,
        type: "line",
        points: [0, 0, 120, 0],
        fill: undefined,
        stroke: "#333",
        strokeWidth: 3,
        name: "Line",
      };
    case "arrow":
      return {
        ...base,
        type: "arrow",
        points: [0, 0, 120, 0],
        fill: "#333",
        stroke: "#333",
        strokeWidth: 3,
        name: "Arrow",
      };
    case "text":
      return {
        ...base,
        type: "text",
        text: "Double-click to edit",
        fontSize: 24,
        fontFamily: "Arial",
        fontStyle: "normal",
        textFill: "#1a1a2e",
        fill: undefined,
        strokeWidth: 0,
        name: "Text",
      };
    case "image":
      return {
        ...base,
        type: "image",
        width: 200,
        height: 150,
        fill: undefined,
        name: "Image",
      };
    default:
      return { ...base, type: "rect", name: "Shape" };
  }
}

// ─── Checkerboard pattern (for transparent bg) ───────────────────────────────

function CheckerboardBg({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const size = 16;
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const cells: { x: number; y: number; dark: boolean }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: c * size, y: r * size, dark: (r + c) % 2 === 1 });
    }
  }
  return (
    <>
      {cells.map((cell, i) => (
        <rect
          key={i}
          x={cell.x}
          y={cell.y}
          width={size}
          height={size}
          fill={cell.dark ? "#d0d0d0" : "#ffffff"}
        />
      ))}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CanvasEditor() {
  // ── Konva dynamic import state ──────────────────────────────────────────
  const [konvaLoaded, setKonvaLoaded] = useState(false);
  const konvaRef = useRef<KonvaLib>(null);
  const reactKonvaRef = useRef<KonvaLib>(null);

  // ── Canvas state ────────────────────────────────────────────────────────
  const [canvasWidth, setCanvasWidthRaw] = useState(1200);
  const [canvasHeight, setCanvasHeightRaw] = useState(630);
  const [background, setBackground] = useState("transparent");
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<ToolMode>("select");
  const [zoom, setZoom] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // ── Refs ────────────────────────────────────────────────────────────────
  const stageRef = useRef<KonvaLib>(null);
  const layerRef = useRef<KonvaLib>(null);
  const transformerRef = useRef<KonvaLib>(null);
  const imageMapRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── History ─────────────────────────────────────────────────────────────
  const historyRef = useRef<HistoryEntry[]>([{ objects: [], background: "transparent" }]);
  const historyIndexRef = useRef(0);

  // ── Text editing overlay ─────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPos, setEditPos] = useState({ x: 0, y: 0, width: 200, height: 40 });
  const [editText, setEditText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Export dropdown ──────────────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);

  // ── Canvas dimension inputs ──────────────────────────────────────────────
  const [widthInput, setWidthInput] = useState("1200");
  const [heightInput, setHeightInput] = useState("630");

  // ─── Load Konva ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [konva, reactKonva] = await Promise.all([
        import("konva"),
        import("react-konva"),
      ]);
      konvaRef.current = konva;
      reactKonvaRef.current = reactKonva;
      setKonvaLoaded(true);
    })();
  }, []);

  // ─── Center canvas on load / resize ──────────────────────────────────────
  const fitCanvas = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const padding = 40;
    const scaleX = (container.clientWidth - padding * 2) / canvasWidth;
    const scaleY = (container.clientHeight - padding * 2) / canvasHeight;
    const newZoom = clamp(Math.min(scaleX, scaleY), 0.1, 5);
    setZoom(newZoom);
    setStagePos({
      x: (container.clientWidth - canvasWidth * newZoom) / 2,
      y: (container.clientHeight - canvasHeight * newZoom) / 2,
    });
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    if (konvaLoaded) {
      fitCanvas();
    }
  }, [konvaLoaded, fitCanvas]);

  // ─── History helpers ───────────────────────────────────────────────────────
  const pushHistory = useCallback(
    (newObjects: CanvasObject[], newBg?: string) => {
      const entry: HistoryEntry = {
        objects: JSON.parse(JSON.stringify(newObjects)),
        background: newBg ?? background,
      };
      // truncate forward history
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push(entry);
      if (historyRef.current.length > 50) {
        historyRef.current.shift();
      }
      historyIndexRef.current = historyRef.current.length - 1;
    },
    [background]
  );

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const entry = historyRef.current[historyIndexRef.current];
    setObjects(JSON.parse(JSON.stringify(entry.objects)));
    setBackground(entry.background);
    setSelectedIds([]);
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const entry = historyRef.current[historyIndexRef.current];
    setObjects(JSON.parse(JSON.stringify(entry.objects)));
    setBackground(entry.background);
    setSelectedIds([]);
  }, []);

  // ─── Mutation helper ───────────────────────────────────────────────────────
  const mutateObjects = useCallback(
    (updater: (prev: CanvasObject[]) => CanvasObject[]) => {
      setObjects((prev) => {
        const next = updater(prev);
        pushHistory(next);
        return next;
      });
    },
    [pushHistory]
  );

  // ─── Transformer sync ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!transformerRef.current || !layerRef.current) return;
    const nodes = selectedIds
      .map((id) => layerRef.current.findOne(`#${id}`))
      .filter(Boolean);
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, objects, konvaLoaded]);

  // ─── Load images into cache ───────────────────────────────────────────────
  useEffect(() => {
    objects.forEach((obj) => {
      if (obj.type === "image" && obj.imageSrc && !imageMapRef.current.has(obj.id)) {
        const img = new window.Image();
        img.src = obj.imageSrc;
        img.onload = () => {
          imageMapRef.current.set(obj.id, img);
          layerRef.current?.batchDraw();
        };
      }
    });
  }, [objects]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length > 0) {
        mutateObjects((prev) => prev.filter((o) => !selectedIds.includes(o.id)));
        setSelectedIds([]);
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        }
        if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          redo();
        }
        if (e.key === "a") {
          e.preventDefault();
          setSelectedIds(objects.map((o) => o.id));
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, objects, undo, redo, mutateObjects]);

  // ─── Clipboard paste for images ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const src = ev.target?.result as string;
            addImageFromSrc(src);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth, canvasHeight]);

  // ─── Add image from src ───────────────────────────────────────────────────
  const addImageFromSrc = useCallback(
    (src: string) => {
      const newObj: CanvasObject = {
        ...defaultObject("image", canvasWidth / 2 - 100, canvasHeight / 2 - 75),
        imageSrc: src,
      };
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        imageMapRef.current.set(newObj.id, img);
        const ratio = img.naturalWidth / img.naturalHeight;
        const w = Math.min(img.naturalWidth, canvasWidth * 0.5);
        const h = w / ratio;
        mutateObjects((prev) => [
          ...prev,
          { ...newObj, x: canvasWidth / 2 - w / 2, y: canvasHeight / 2 - h / 2, width: w, height: h },
        ]);
        setTool("select");
        setSelectedIds([newObj.id]);
      };
    },
    [canvasWidth, canvasHeight, mutateObjects]
  );

  // ─── Stage click (create objects) ─────────────────────────────────────────
  const handleStageMouseDown = useCallback(
    (e: KonvaLib) => {
      if (editingId) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;

      // Convert from stage coords to canvas coords
      const x = (pointerPos.x - stagePos.x) / zoom;
      const y = (pointerPos.y - stagePos.y) / zoom;

      // Clicked on empty area with select tool → deselect
      if (tool === "select") {
        const clickedOnEmpty = e.target === stage || e.target.name() === "canvas-bg";
        if (clickedOnEmpty) {
          setSelectedIds([]);
        }
        return;
      }

      if (tool === "image") return; // handled by file input

      const newObj = defaultObject(tool, x, y);
      mutateObjects((prev) => [...prev, newObj]);
      setTool("select");
      setSelectedIds([newObj.id]);
    },
    [tool, zoom, stagePos, editingId, mutateObjects]
  );

  // ─── Object click (select) ────────────────────────────────────────────────
  const handleObjectClick = useCallback(
    (e: KonvaLib, id: string) => {
      if (tool !== "select") return;
      e.cancelBubble = true;
      const obj = objects.find((o) => o.id === id);
      if (obj?.locked) return;
      if (e.evt?.shiftKey) {
        setSelectedIds((prev) =>
          prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
      } else {
        setSelectedIds([id]);
      }
    },
    [tool, objects]
  );

  // ─── Object drag end ──────────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (e: KonvaLib, id: string) => {
      mutateObjects((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, x: e.target.x(), y: e.target.y() } : o
        )
      );
    },
    [mutateObjects]
  );

  // ─── Transformer change end ───────────────────────────────────────────────
  const handleTransformEnd = useCallback(
    (e: KonvaLib, id: string) => {
      const node = e.target;
      const obj = objects.find((o) => o.id === id);
      if (!obj) return;

      if (obj.type === "line" || obj.type === "arrow") {
        mutateObjects((prev) =>
          prev.map((o) =>
            o.id === id
              ? { ...o, x: node.x(), y: node.y(), rotation: node.rotation() }
              : o
          )
        );
      } else {
        mutateObjects((prev) =>
          prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  x: node.x(),
                  y: node.y(),
                  width: (o.width ?? 100) * node.scaleX(),
                  height: (o.height ?? 100) * node.scaleY(),
                  rotation: node.rotation(),
                }
              : o
          )
        );
        node.scaleX(1);
        node.scaleY(1);
      }
    },
    [objects, mutateObjects]
  );

  // ─── Double-click text to edit ────────────────────────────────────────────
  const handleTextDblClick = useCallback(
    (e: KonvaLib, id: string) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj || obj.type !== "text") return;

      const textNode = e.target;
      const stage = stageRef.current;
      if (!stage) return;

      const absPos = textNode.getAbsolutePosition();
      const stageBox = stage.container().getBoundingClientRect();
      const containerBox = containerRef.current?.getBoundingClientRect();
      if (!containerBox) return;

      setEditPos({
        x: stageBox.left - containerBox.left + absPos.x,
        y: stageBox.top - containerBox.top + absPos.y,
        width: Math.max((obj.width ?? 200) * zoom, 80),
        height: Math.max((obj.fontSize ?? 24) * zoom * 1.5, 32),
      });
      setEditText(obj.text ?? "");
      setEditingId(id);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [objects, zoom]
  );

  const commitTextEdit = useCallback(() => {
    if (!editingId) return;
    mutateObjects((prev) =>
      prev.map((o) =>
        o.id === editingId ? { ...o, text: editText } : o
      )
    );
    setEditingId(null);
    setEditText("");
  }, [editingId, editText, mutateObjects]);

  // ─── Wheel zoom ───────────────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: KonvaLib) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const oldZoom = zoom;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newZoom = clamp(oldZoom * (1 + direction * 0.1), 0.1, 5);

      const mousePointTo = {
        x: (pointer.x - stagePos.x) / oldZoom,
        y: (pointer.y - stagePos.y) / oldZoom,
      };

      setZoom(newZoom);
      setStagePos({
        x: pointer.x - mousePointTo.x * newZoom,
        y: pointer.y - mousePointTo.y * newZoom,
      });
    },
    [zoom, stagePos]
  );

  // ─── Property updates ─────────────────────────────────────────────────────
  const updateSelected = useCallback(
    (patch: Partial<CanvasObject>) => {
      mutateObjects((prev) =>
        prev.map((o) => (selectedIds.includes(o.id) ? { ...o, ...patch } : o))
      );
    },
    [selectedIds, mutateObjects]
  );

  // ─── Canvas dimension change ──────────────────────────────────────────────
  const applyDimensions = useCallback(() => {
    const w = parseInt(widthInput);
    const h = parseInt(heightInput);
    if (!isNaN(w) && w > 0) setCanvasWidthRaw(w);
    if (!isNaN(h) && h > 0) setCanvasHeightRaw(h);
  }, [widthInput, heightInput]);

  // ─── Export ───────────────────────────────────────────────────────────────
  const exportCanvas = useCallback(
    (format: "png" | "jpeg") => {
      const stage = stageRef.current;
      if (!stage) return;

      // Hide transformer
      transformerRef.current?.hide();
      layerRef.current?.batchDraw();

      const dataUrl = stage.toDataURL({
        mimeType: format === "png" ? "image/png" : "image/jpeg",
        quality: 1,
        x: stagePos.x,
        y: stagePos.y,
        width: canvasWidth * zoom,
        height: canvasHeight * zoom,
        pixelRatio: 1 / zoom,
      });

      transformerRef.current?.show();
      layerRef.current?.batchDraw();

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `canvas.${format}`;
      a.click();
      setExportOpen(false);
    },
    [stagePos, canvasWidth, canvasHeight, zoom]
  );

  // ─── File input for image upload ──────────────────────────────────────────
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;
        addImageFromSrc(src);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [addImageFromSrc]
  );

  // ─── Selected object(s) ───────────────────────────────────────────────────
  const selectedObjects = useMemo(
    () => objects.filter((o) => selectedIds.includes(o.id)),
    [objects, selectedIds]
  );

  const firstSelected = selectedObjects[0];
  const hasSelection = selectedObjects.length > 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!konvaLoaded || !reactKonvaRef.current || !konvaRef.current) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
          <span className="text-sm text-muted-foreground">Loading canvas engine…</span>
        </div>
      </div>
    );
  }

  const { Stage, Layer, Rect, Circle: KCircle, Line, Arrow, Text: KText, Image: KImage, Transformer } =
    reactKonvaRef.current;

  const toolButtons: { mode: ToolMode; icon: React.ReactNode; title: string }[] = [
    { mode: "select", icon: <MousePointer2 className="h-4 w-4" />, title: "Select (V)" },
    { mode: "text", icon: <Type className="h-4 w-4" />, title: "Text (T)" },
    { mode: "rect", icon: <Square className="h-4 w-4" />, title: "Rectangle (R)" },
    { mode: "circle", icon: <Circle className="h-4 w-4" />, title: "Circle (C)" },
    { mode: "line", icon: <Minus className="h-4 w-4" />, title: "Line (L)" },
    { mode: "arrow", icon: <ArrowUpRight className="h-4 w-4" />, title: "Arrow (A)" },
    { mode: "image", icon: <ImagePlus className="h-4 w-4" />, title: "Image (I)" },
  ];

  // Stage container size — full available area
  const containerWidth = containerRef.current?.clientWidth ?? 800;
  const containerHeight = containerRef.current?.clientHeight ?? 600;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Toolbar ── */}
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        {/* Left: title + undo/redo */}
        <div className="flex items-center gap-1.5">
          <PenTool className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Canvas Editor</span>
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={undo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={redo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>

        {/* Center: canvas dimensions */}
        <div className="mx-2 h-5 w-px bg-border" />
        <div className="flex items-center gap-1">
          <input
            className="h-7 w-16 rounded border border-border bg-transparent px-1.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            value={widthInput}
            onChange={(e) => setWidthInput(e.target.value)}
            onBlur={applyDimensions}
            onKeyDown={(e) => e.key === "Enter" && applyDimensions()}
            title="Canvas width"
          />
          <span className="text-xs text-muted-foreground">×</span>
          <input
            className="h-7 w-16 rounded border border-border bg-transparent px-1.5 text-center text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            onBlur={applyDimensions}
            onKeyDown={(e) => e.key === "Enter" && applyDimensions()}
            title="Canvas height"
          />
        </div>

        {/* Right: zoom + export */}
        <div className="ml-auto flex items-center gap-1">
          <div className="flex items-center gap-1 rounded border border-border px-2 py-1">
            <ZoomIn className="h-3 w-3 text-muted-foreground" />
            <span className="w-10 text-center text-xs">{Math.round(zoom * 100)}%</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fitCanvas}
            title="Fit to window"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setExportOpen((v) => !v)}
            >
              <Download className="h-3.5 w-3.5" />
              Export
              <ChevronDown className="h-3 w-3" />
            </Button>
            {exportOpen && (
              <div className="absolute right-0 top-8 z-50 flex min-w-36 flex-col rounded-md border border-border bg-popover shadow-lg">
                <button
                  className="px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => exportCanvas("png")}
                >
                  Download as PNG
                </button>
                <button
                  className="px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => exportCanvas("jpeg")}
                >
                  Download as JPG
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── Left tool palette ── */}
        <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border py-2">
          {toolButtons.map(({ mode, icon, title }) => (
            <button
              key={mode}
              title={title}
              onClick={() => {
                if (mode === "image") {
                  fileInputRef.current?.click();
                } else {
                  setTool(mode);
                }
              }}
              className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
                tool === mode
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {icon}
            </button>
          ))}

          <div className="my-1 h-px w-6 bg-border" />

          {/* Background color */}
          <div className="relative flex h-8 w-8 items-center justify-center" title="Background color">
            <Paintbrush className="pointer-events-none absolute h-4 w-4 text-muted-foreground" />
            <input
              type="color"
              value={background === "transparent" ? "#ffffff" : background}
              onChange={(e) => {
                setBackground(e.target.value);
                pushHistory(objects, e.target.value);
              }}
              className="h-8 w-8 cursor-pointer rounded opacity-0"
              title="Background color"
            />
          </div>
        </aside>

        {/* ── Canvas area ── */}
        <div
          ref={containerRef}
          className="relative min-w-0 flex-1 overflow-hidden bg-muted/30"
          onClick={() => exportOpen && setExportOpen(false)}
        >
          <Stage
            ref={stageRef}
            width={containerWidth}
            height={containerHeight}
            x={stagePos.x}
            y={stagePos.y}
            scaleX={zoom}
            scaleY={zoom}
            onMouseDown={handleStageMouseDown}
            onWheel={handleWheel}
            style={{ cursor: tool === "select" ? "default" : "crosshair" }}
          >
            <Layer ref={layerRef}>
              {/* Canvas background */}
              {background === "transparent" ? (
                <>{/* Rendered via SVG-based checkerboard isn't possible in Konva; use rects */}
                  {Array.from({ length: Math.ceil(canvasWidth / 16) * Math.ceil(canvasHeight / 16) }, (_, i) => {
                    const cols = Math.ceil(canvasWidth / 16);
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    return (
                      <Rect
                        key={i}
                        x={col * 16}
                        y={row * 16}
                        width={16}
                        height={16}
                        fill={(col + row) % 2 === 0 ? "#ffffff" : "#d0d0d0"}
                        listening={false}
                        name="canvas-bg"
                      />
                    );
                  })}
                </>
              ) : (
                <Rect
                  x={0}
                  y={0}
                  width={canvasWidth}
                  height={canvasHeight}
                  fill={background}
                  name="canvas-bg"
                  listening={true}
                />
              )}

              {/* Objects */}
              {objects.map((obj) => {
                if (!obj.visible) return null;
                const isSelected = selectedIds.includes(obj.id);
                const isDraggable = tool === "select" && !obj.locked;
                const commonProps = {
                  key: obj.id,
                  id: obj.id,
                  x: obj.x,
                  y: obj.y,
                  rotation: obj.rotation,
                  opacity: obj.opacity,
                  draggable: isDraggable,
                  onClick: (e: KonvaLib) => handleObjectClick(e, obj.id),
                  onDragEnd: (e: KonvaLib) => handleDragEnd(e, obj.id),
                  onTransformEnd: (e: KonvaLib) => handleTransformEnd(e, obj.id),
                };

                if (obj.type === "rect") {
                  return (
                    <Rect
                      {...commonProps}
                      width={obj.width ?? 100}
                      height={obj.height ?? 100}
                      fill={obj.fill}
                      stroke={isSelected ? undefined : obj.stroke}
                      strokeWidth={obj.strokeWidth ?? 0}
                    />
                  );
                }

                if (obj.type === "circle") {
                  const r = (obj.width ?? 150) / 2;
                  return (
                    <KCircle
                      {...commonProps}
                      radius={r}
                      fill={obj.fill}
                      stroke={isSelected ? undefined : obj.stroke}
                      strokeWidth={obj.strokeWidth ?? 0}
                    />
                  );
                }

                if (obj.type === "line") {
                  return (
                    <Line
                      {...commonProps}
                      points={obj.points ?? [0, 0, 100, 0]}
                      stroke={obj.stroke ?? "#333"}
                      strokeWidth={obj.strokeWidth ?? 2}
                    />
                  );
                }

                if (obj.type === "arrow") {
                  return (
                    <Arrow
                      {...commonProps}
                      points={obj.points ?? [0, 0, 100, 0]}
                      fill={obj.fill ?? "#333"}
                      stroke={obj.stroke ?? "#333"}
                      strokeWidth={obj.strokeWidth ?? 2}
                      pointerLength={10}
                      pointerWidth={10}
                    />
                  );
                }

                if (obj.type === "text") {
                  return (
                    <KText
                      {...commonProps}
                      text={obj.text ?? ""}
                      fontSize={obj.fontSize ?? 24}
                      fontFamily={obj.fontFamily ?? "Arial"}
                      fontStyle={obj.fontStyle ?? "normal"}
                      fill={obj.textFill ?? "#000"}
                      onDblClick={(e: KonvaLib) => handleTextDblClick(e, obj.id)}
                    />
                  );
                }

                if (obj.type === "image") {
                  const cachedImg = imageMapRef.current.get(obj.id);
                  if (!cachedImg) return null;
                  return (
                    <KImage
                      {...commonProps}
                      image={cachedImg}
                      width={obj.width ?? 200}
                      height={obj.height ?? 150}
                    />
                  );
                }

                return null;
              })}

              {/* Transformer */}
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox: KonvaLib, newBox: KonvaLib) => {
                  if (newBox.width < 5 || newBox.height < 5) return oldBox;
                  return newBox;
                }}
              />
            </Layer>
          </Stage>

          {/* Text editing overlay */}
          {editingId && (
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={commitTextEdit}
              onKeyDown={(e) => {
                if (e.key === "Escape") commitTextEdit();
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitTextEdit();
                }
              }}
              style={{
                position: "absolute",
                left: editPos.x,
                top: editPos.y,
                width: editPos.width,
                minHeight: editPos.height,
                fontSize: (objects.find((o) => o.id === editingId)?.fontSize ?? 24) * zoom,
                fontFamily: objects.find((o) => o.id === editingId)?.fontFamily ?? "Arial",
                transform: `rotate(${objects.find((o) => o.id === editingId)?.rotation ?? 0}deg)`,
                transformOrigin: "top left",
              }}
              className="z-50 resize-none border border-primary bg-background/90 p-0 leading-tight text-foreground outline-none"
            />
          )}
        </div>

        {/* ── Right panel ── */}
        <aside className="flex w-60 shrink-0 flex-col overflow-y-auto border-l border-border bg-background text-sm">
          {/* Properties */}
          {hasSelection && (
            <div className="border-b border-border p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Properties
              </div>
              <div className="flex flex-col gap-2">
                {/* Fill (not for line/arrow/text) */}
                {!["line", "arrow", "text"].includes(firstSelected?.type) && (
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Fill</label>
                    <input
                      type="color"
                      value={firstSelected?.fill ?? "#000000"}
                      onChange={(e) => updateSelected({ fill: e.target.value })}
                      className="h-6 w-10 cursor-pointer rounded border border-border"
                    />
                  </div>
                )}

                {/* Text fill */}
                {firstSelected?.type === "text" && (
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Color</label>
                    <input
                      type="color"
                      value={firstSelected?.textFill ?? "#000000"}
                      onChange={(e) => updateSelected({ textFill: e.target.value })}
                      className="h-6 w-10 cursor-pointer rounded border border-border"
                    />
                  </div>
                )}

                {/* Stroke (not for text) */}
                {firstSelected?.type !== "text" && (
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Stroke</label>
                    <input
                      type="color"
                      value={firstSelected?.stroke ?? "#000000"}
                      onChange={(e) => updateSelected({ stroke: e.target.value })}
                      className="h-6 w-10 cursor-pointer rounded border border-border"
                    />
                  </div>
                )}

                {/* Stroke width (not for text) */}
                {firstSelected?.type !== "text" && (
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground">Stroke W</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={firstSelected?.strokeWidth ?? 0}
                      onChange={(e) =>
                        updateSelected({ strokeWidth: parseFloat(e.target.value) || 0 })
                      }
                      className="h-6 w-16 rounded border border-border bg-transparent px-1.5 text-right text-xs"
                    />
                  </div>
                )}

                {/* Opacity */}
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-muted-foreground">Opacity</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={firstSelected?.opacity ?? 1}
                      onChange={(e) =>
                        updateSelected({ opacity: parseFloat(e.target.value) })
                      }
                      className="w-20"
                    />
                    <span className="w-8 text-right text-xs text-muted-foreground">
                      {Math.round((firstSelected?.opacity ?? 1) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Rotation */}
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground">Rotation</label>
                  <input
                    type="number"
                    min={-360}
                    max={360}
                    value={Math.round(firstSelected?.rotation ?? 0)}
                    onChange={(e) =>
                      updateSelected({ rotation: parseFloat(e.target.value) || 0 })
                    }
                    className="h-6 w-16 rounded border border-border bg-transparent px-1.5 text-right text-xs"
                  />
                </div>

                {/* Text-specific */}
                {firstSelected?.type === "text" && (
                  <>
                    <div className="mt-1 border-t border-border pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Text
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Size</label>
                      <input
                        type="number"
                        min={6}
                        max={400}
                        value={firstSelected?.fontSize ?? 24}
                        onChange={(e) =>
                          updateSelected({ fontSize: parseInt(e.target.value) || 24 })
                        }
                        className="h-6 w-16 rounded border border-border bg-transparent px-1.5 text-right text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Font</label>
                      <select
                        value={firstSelected?.fontFamily ?? "Arial"}
                        onChange={(e) => updateSelected({ fontFamily: e.target.value })}
                        className="h-6 w-32 rounded border border-border bg-background px-1 text-xs"
                      >
                        {FONT_FAMILIES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Style</label>
                      <select
                        value={firstSelected?.fontStyle ?? "normal"}
                        onChange={(e) => updateSelected({ fontStyle: e.target.value })}
                        className="h-6 w-32 rounded border border-border bg-background px-1 text-xs"
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="italic">Italic</option>
                        <option value="bold italic">Bold Italic</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Delete */}
                <div className="mt-1 border-t border-border pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      mutateObjects((prev) =>
                        prev.filter((o) => !selectedIds.includes(o.id))
                      );
                      setSelectedIds([]);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete selected
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Layers */}
          <div className="flex-1 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Layers
            </div>
            {objects.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">No objects yet</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {[...objects].reverse().map((obj) => {
                  const isSelected = selectedIds.includes(obj.id);
                  return (
                    <div
                      key={obj.id}
                      onClick={() => {
                        if (!obj.locked) setSelectedIds([obj.id]);
                      }}
                      className={`group flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 ${
                        isSelected
                          ? "bg-foreground/10"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <span
                        className={`min-w-0 flex-1 truncate text-xs ${
                          !obj.visible ? "text-muted-foreground/40" : ""
                        }`}
                      >
                        {obj.name}
                      </span>
                      <button
                        title={obj.visible ? "Hide" : "Show"}
                        onClick={(e) => {
                          e.stopPropagation();
                          mutateObjects((prev) =>
                            prev.map((o) =>
                              o.id === obj.id ? { ...o, visible: !o.visible } : o
                            )
                          );
                        }}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      >
                        {obj.visible ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                      <button
                        title={obj.locked ? "Unlock" : "Lock"}
                        onClick={(e) => {
                          e.stopPropagation();
                          mutateObjects((prev) =>
                            prev.map((o) =>
                              o.id === obj.id ? { ...o, locked: !o.locked } : o
                            )
                          );
                        }}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      >
                        {obj.locked ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <Unlock className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

export interface WebcamDevice {
  deviceId: string;
  label: string;
}

export interface WebcamInfo {
  width: number;
  height: number;
  frameRate: number;
  aspectRatio: string;
  facingMode: string;
  deviceId: string;
  label: string;
}

export async function listVideoDevices(): Promise<WebcamDevice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `Camera ${i + 1}`,
    }));
}

export function getStreamInfo(
  stream: MediaStream,
  label: string
): WebcamInfo | null {
  const track = stream.getVideoTracks()[0];
  if (!track) return null;
  const settings = track.getSettings();
  const w = settings.width ?? 0;
  const h = settings.height ?? 0;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = w && h ? gcd(w, h) : 1;
  return {
    width: w,
    height: h,
    frameRate: Math.round(settings.frameRate ?? 0),
    aspectRatio: w && h ? `${w / d}:${h / d}` : "N/A",
    facingMode: settings.facingMode || "N/A",
    deviceId: settings.deviceId || "",
    label,
  };
}

export function captureFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(video, 0, 0);
  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function copyCanvasToClipboard(
  canvas: HTMLCanvasElement
): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed"))), "image/png");
  });
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

// === Brightness / exposure analysis ===

export type BrightnessLevel = "dark" | "dim" | "good" | "bright" | "overexposed";

export function measureBrightness(video: HTMLVideoElement): number {
  const canvas = document.createElement("canvas");
  // Sample at low resolution for performance
  const w = 160;
  const h = Math.round((video.videoHeight / video.videoWidth) * w) || 90;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  const pixels = w * h;
  for (let i = 0; i < data.length; i += 4) {
    // Perceived luminance: 0.299R + 0.587G + 0.114B
    sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  return sum / pixels / 255; // 0..1
}

export function getBrightnessLabel(brightness: number): {
  label: string;
  level: BrightnessLevel;
} {
  if (brightness < 0.08) return { label: "Too dark", level: "dark" };
  if (brightness < 0.2) return { label: "Dim", level: "dim" };
  if (brightness < 0.75) return { label: "Good", level: "good" };
  if (brightness < 0.9) return { label: "Bright", level: "bright" };
  return { label: "Overexposed", level: "overexposed" };
}

// === Diagnostic verdict ===

export type CamDiagStatus = "good" | "warning" | "error";

export interface CamDiagItem {
  label: string;
  ok: boolean;
}

export interface CamDiagResult {
  status: CamDiagStatus;
  message: string;
  items: CamDiagItem[];
}

export function diagnoseCam(opts: {
  hasStream: boolean;
  width: number;
  height: number;
  frameRate: number;
  actualFps: number;
  brightness: number;
}): CamDiagResult {
  const items: CamDiagItem[] = [];

  items.push({
    label: opts.hasStream
      ? "Camera connected"
      : "No camera signal — check permissions",
    ok: opts.hasStream,
  });

  const isHd = opts.width >= 1280 && opts.height >= 720;
  items.push({
    label: isHd
      ? `HD resolution (${opts.width}\u00d7${opts.height})`
      : `Low resolution (${opts.width}\u00d7${opts.height}) — try closing other apps using the camera`,
    ok: isHd,
  });

  const fpsOk = opts.actualFps >= opts.frameRate * 0.7;
  items.push({
    label: fpsOk
      ? `Stable frame rate (${Math.round(opts.actualFps)} fps)`
      : `Frame drops detected (${Math.round(opts.actualFps)}/${opts.frameRate} fps) — close other tabs or apps`,
    ok: fpsOk,
  });

  const bright = getBrightnessLabel(opts.brightness);
  const brightOk = bright.level === "good" || bright.level === "bright";
  items.push({
    label: brightOk
      ? `Good lighting (${bright.label})`
      : bright.level === "dark" || bright.level === "dim"
        ? `${bright.label} — improve your lighting`
        : `${bright.label} — reduce light or adjust exposure`,
    ok: brightOk,
  });

  const hasError = !opts.hasStream;
  const warningCount = items.filter((i) => !i.ok).length;

  return {
    status: hasError ? "error" : warningCount > 0 ? "warning" : "good",
    message: hasError
      ? "No camera signal detected"
      : warningCount > 0
        ? "Working with issues"
        : "Your webcam is working great",
    items,
  };
}

// === FPS counter ===

export class FpsCounter {
  private timestamps: number[] = [];

  tick(now: number) {
    this.timestamps.push(now);
    // Keep last 2 seconds
    const cutoff = now - 2000;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
  }

  get fps(): number {
    if (this.timestamps.length < 2) return 0;
    const span =
      this.timestamps[this.timestamps.length - 1] - this.timestamps[0];
    if (span === 0) return 0;
    return ((this.timestamps.length - 1) / span) * 1000;
  }

  reset() {
    this.timestamps = [];
  }
}

// === Format helpers ===

export function formatRecordingDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatVideoSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

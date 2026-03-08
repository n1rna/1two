"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  Video,
  VideoOff,
  Download,
  Copy,
  Check,
  X,
  Info,
} from "lucide-react";
import {
  listVideoDevices,
  getStreamInfo,
  captureFrame,
  downloadCanvas,
  copyCanvasToClipboard,
  type WebcamDevice,
  type WebcamInfo,
} from "@/lib/tools/webcam";

export function WebcamTester() {
  const [devices, setDevices] = useState<WebcamDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [info, setInfo] = useState<WebcamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [mirrored, setMirrored] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Enumerate devices on mount (needs initial permission prompt)
  useEffect(() => {
    async function init() {
      try {
        // Request temporary access to get labeled device list
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        tempStream.getTracks().forEach((t) => t.stop());
        const devs = await listVideoDevices();
        setDevices(devs);
        if (devs.length > 0 && !selectedId) {
          setSelectedId(devs[0].deviceId);
        }
      } catch {
        setError("Camera permission denied or no camera found");
      }
    }
    init();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startStream = useCallback(
    async (deviceId: string) => {
      setError(null);
      setCapture(null);

      // Stop existing stream
      streamRef.current?.getTracks().forEach((t) => t.stop());

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Re-enumerate to get updated labels
        const devs = await listVideoDevices();
        setDevices(devs);

        const label =
          devs.find((d) => d.deviceId === deviceId)?.label || "Camera";
        setInfo(getStreamInfo(stream, label));
        setStreaming(true);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to access camera"
        );
        setStreaming(false);
      }
    },
    []
  );

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    setInfo(null);
  }, []);

  const handleDeviceChange = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (streaming) {
        startStream(id);
      }
    },
    [streaming, startStream]
  );

  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = captureFrame(videoRef.current);
    setCapture(canvas);
  }, []);

  const handleDownload = useCallback(() => {
    if (!capture) return;
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    downloadCanvas(capture, `webcam-${ts}.png`);
  }, [capture]);

  const handleCopyCapture = useCallback(async () => {
    if (!capture) return;
    try {
      await copyCanvasToClipboard(capture);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy image to clipboard");
    }
  }, [capture]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Webcam Test</span>

          {info && (
            <div className="flex items-center gap-1 text-xs text-green-500 ml-2">
              <Check className="h-3.5 w-3.5" />
              Active
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {devices.length > 1 && (
              <Select value={selectedId} onValueChange={(v) => v && handleDeviceChange(v)}>
                <SelectTrigger size="sm" className="text-xs">
                  <SelectValue
                    placeholder="Select camera"
                  >
                    {devices.find((d) => d.deviceId === selectedId)?.label || "Select camera"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="end" className="w-auto max-w-80">
                  {devices.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={mirrored}
                onChange={(e) => setMirrored(e.target.checked)}
                className="rounded border-input"
              />
              Mirror
            </label>

            {!streaming ? (
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => startStream(selectedId)}
                disabled={!selectedId}
              >
                <Video className="h-3.5 w-3.5" />
                Start
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                className="h-7 gap-1.5 text-xs"
                onClick={stopStream}
              >
                <VideoOff className="h-3.5 w-3.5" />
                Stop
              </Button>
            )}

            {streaming && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={handleCapture}
              >
                <Camera className="h-3.5 w-3.5" />
                Capture
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3">
              <Info className="h-4 w-4 shrink-0" />
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-auto shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Video preview */}
          <div className="relative bg-muted/30 rounded-lg overflow-hidden border">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full aspect-video object-contain bg-black ${
                mirrored ? "scale-x-[-1]" : ""
              }`}
              style={{ display: streaming ? "block" : "none" }}
            />
            {!streaming && (
              <div className="w-full aspect-video flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Camera className="h-10 w-10 opacity-30" />
                <div className="text-sm">
                  {devices.length === 0
                    ? "No cameras detected"
                    : "Click Start to begin"}
                </div>
                {devices.length > 0 && !streaming && (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => startStream(selectedId)}
                    disabled={!selectedId}
                  >
                    <Video className="h-3.5 w-3.5" />
                    Start Camera
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Device info */}
          {info && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: "Resolution", value: `${info.width}×${info.height}` },
                { label: "Frame Rate", value: `${info.frameRate} fps` },
                { label: "Aspect Ratio", value: info.aspectRatio },
                { label: "Facing", value: info.facingMode },
                {
                  label: "Device",
                  value: info.label,
                },
                {
                  label: "Megapixels",
                  value: `${((info.width * info.height) / 1_000_000).toFixed(1)} MP`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-muted/40 rounded-lg px-3 py-2"
                >
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {item.label}
                  </div>
                  <div className="text-sm font-medium mt-0.5 truncate">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Captured frame */}
          {capture && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Captured Frame
                </span>
                <span className="text-xs text-muted-foreground/50">
                  {capture.width}×{capture.height}
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleCopyCapture}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleDownload}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => setCapture(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="rounded-lg overflow-hidden border bg-black">
                <img
                  src={capture.toDataURL("image/png")}
                  alt="Captured frame"
                  className={`w-full aspect-video object-contain ${
                    mirrored ? "scale-x-[-1]" : ""
                  }`}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

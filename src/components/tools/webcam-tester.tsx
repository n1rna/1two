"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Camera,
  Video,
  VideoOff,
  Download,
  Copy,
  Check,
  X,
  Info,
  Play,
  Pause,
  Square,
  Circle,
  Trash2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  listVideoDevices,
  getStreamInfo,
  captureFrame,
  downloadCanvas,
  copyCanvasToClipboard,
  measureBrightness,
  getBrightnessLabel,
  diagnoseCam,
  FpsCounter,
  formatRecordingDuration,
  formatVideoSize,
  type WebcamDevice,
  type WebcamInfo,
  type CamDiagResult,
} from "@/lib/tools/webcam";

interface Capture {
  id: number;
  canvas: HTMLCanvasElement;
  dataUrl: string;
  timestamp: Date;
}

interface VideoRecording {
  id: number;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  thumbnail: string;
}

type GalleryItem =
  | { type: "capture"; data: Capture }
  | { type: "recording"; data: VideoRecording };

let nextCaptureId = 0;
let nextRecordingId = 0;

export function WebcamTester() {
  // === Core state ===
  const [devices, setDevices] = useState<WebcamDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [info, setInfo] = useState<WebcamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mirrored, setMirrored] = useState(true);

  // === Captures ===
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [previewCap, setPreviewCap] = useState<Capture | null>(null);

  // === Video recording ===
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [videoRecordings, setVideoRecordings] = useState<VideoRecording[]>([]);
  const [playbackRec, setPlaybackRec] = useState<VideoRecording | null>(null);

  // === Diagnostics ===
  const [brightness, setBrightness] = useState(0);
  const [actualFps, setActualFps] = useState(0);
  const [diagReady, setDiagReady] = useState(false);

  // === Refs ===
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fpsCounterRef = useRef(new FpsCounter());
  const lastVideoTimeRef = useRef(0);
  const brightnessIntervalRef = useRef<ReturnType<typeof setInterval>>(
    0 as unknown as ReturnType<typeof setInterval>
  );
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval>>(
    0 as unknown as ReturnType<typeof setInterval>
  );

  // === Lifecycle ===

  useEffect(() => {
    async function init() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        tempStream.getTracks().forEach((t) => t.stop());
        const devs = await listVideoDevices();
        setDevices(devs);
        if (devs.length > 0) setSelectedId(devs[0].deviceId);
      } catch {
        setError("Camera permission denied or no camera found");
      }
    }
    init();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafRef.current);
      clearInterval(brightnessIntervalRef.current);
      clearInterval(recTimerRef.current);
    };
  }, []);

  // Cleanup capture URLs on unmount
  useEffect(() => {
    return () => {
      videoRecordings.forEach((r) => URL.revokeObjectURL(r.url));
    };
  }, []);

  // Diagnostic readiness timer
  useEffect(() => {
    if (!streaming) {
      setDiagReady(false);
      return;
    }
    const timer = setTimeout(() => setDiagReady(true), 3000);
    return () => clearTimeout(timer);
  }, [streaming]);

  // === FPS tracking loop ===

  const trackFps = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streaming) return;

    // Only count when a new frame is rendered
    const currentTime = video.currentTime;
    if (currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = currentTime;
      fpsCounterRef.current.tick(performance.now());
      setActualFps(fpsCounterRef.current.fps);
    }

    rafRef.current = requestAnimationFrame(trackFps);
  }, [streaming]);

  // === Brightness sampling ===

  const startMonitoring = useCallback(() => {
    fpsCounterRef.current.reset();
    lastVideoTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(trackFps);

    // Sample brightness every 500ms
    brightnessIntervalRef.current = setInterval(() => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        setBrightness(measureBrightness(videoRef.current));
      }
    }, 500);
  }, [trackFps]);

  const stopMonitoring = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    clearInterval(brightnessIntervalRef.current);
    fpsCounterRef.current.reset();
    setActualFps(0);
    setBrightness(0);
  }, []);

  // === Controls ===

  const startStream = useCallback(
    async (deviceId: string) => {
      setError(null);
      stopMonitoring();

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

        const devs = await listVideoDevices();
        setDevices(devs);
        const label =
          devs.find((d) => d.deviceId === deviceId)?.label || "Camera";
        setInfo(getStreamInfo(stream, label));
        setStreaming(true);

        startMonitoring();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to access camera"
        );
        setStreaming(false);
      }
    },
    [startMonitoring, stopMonitoring]
  );

  const stopStream = useCallback(() => {
    if (isRecording) stopVideoRecording();
    stopMonitoring();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
    setInfo(null);
    setDiagReady(false);
  }, [isRecording, stopMonitoring]);

  const handleDeviceChange = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (streaming) startStream(id);
    },
    [streaming, startStream]
  );

  // === Captures ===

  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = captureFrame(videoRef.current);
    const dataUrl = canvas.toDataURL("image/png");
    setCaptures((prev) => [
      {
        id: nextCaptureId++,
        canvas,
        dataUrl,
        timestamp: new Date(),
      },
      ...prev,
    ]);
  }, []);

  const handleDownloadCapture = useCallback((cap: Capture) => {
    const ts = cap.timestamp.toISOString().replace(/[:.]/g, "-");
    downloadCanvas(cap.canvas, `webcam-${ts}.png`);
  }, []);

  const handleCopyCapture = useCallback(
    async (cap: Capture) => {
      try {
        await copyCanvasToClipboard(cap.canvas);
        setCopiedId(cap.id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        setError("Failed to copy image to clipboard");
      }
    },
    []
  );

  const handleDeleteCapture = useCallback((id: number) => {
    setCaptures((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // === Video recording ===

  const startVideoRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const duration = (Date.now() - recStartRef.current) / 1000;
      // Grab thumbnail from live video at moment of stop
      let thumbnail = "";
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const canvas = captureFrame(videoRef.current);
        thumbnail = canvas.toDataURL("image/jpeg", 0.7);
      }
      setVideoRecordings((prev) => [
        {
          id: nextRecordingId++,
          blob,
          url,
          duration,
          timestamp: new Date(),
          thumbnail,
        },
        ...prev,
      ]);
    };
    recorderRef.current = recorder;
    recStartRef.current = Date.now();
    setRecordingTime(0);
    recorder.start(100);
    setIsRecording(true);

    recTimerRef.current = setInterval(() => {
      setRecordingTime((Date.now() - recStartRef.current) / 1000);
    }, 100);
  }, []);

  const stopVideoRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    clearInterval(recTimerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const handlePlayRecording = useCallback((rec: VideoRecording) => {
    setPlaybackRec(rec);
  }, []);

  const handleDownloadRecording = useCallback((rec: VideoRecording) => {
    const a = document.createElement("a");
    a.href = rec.url;
    const ts = rec.timestamp.toISOString().replace(/[:.]/g, "-");
    a.download = `webcam-recording-${ts}.webm`;
    a.click();
  }, []);

  const handleDeleteRecording = useCallback(
    (id: number) => {
      if (playbackRec?.id === id) setPlaybackRec(null);
      setVideoRecordings((prev) => {
        const rec = prev.find((r) => r.id === id);
        if (rec) URL.revokeObjectURL(rec.url);
        return prev.filter((r) => r.id !== id);
      });
    },
    [playbackRec]
  );

  // === Computed ===

  const diagnostic: CamDiagResult | null = useMemo(() => {
    if (!diagReady || !info) return null;
    return diagnoseCam({
      hasStream: streaming,
      width: info.width,
      height: info.height,
      frameRate: info.frameRate,
      actualFps,
      brightness,
    });
  }, [diagReady, info, streaming, actualFps, brightness]);

  const brightnessInfo = brightness > 0 ? getBrightnessLabel(brightness) : null;

  const galleryItems: GalleryItem[] = useMemo(() => {
    const items: GalleryItem[] = [
      ...captures.map((c) => ({ type: "capture" as const, data: c })),
      ...videoRecordings.map((r) => ({ type: "recording" as const, data: r })),
    ];
    items.sort((a, b) => b.data.timestamp.getTime() - a.data.timestamp.getTime());
    return items;
  }, [captures, videoRecordings]);

  // === Render ===

  return (
    <div className="flex flex-col">
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
              <Select
                value={selectedId}
                onValueChange={(v) => v && handleDeviceChange(v)}
              >
                <SelectTrigger size="sm" className="text-xs">
                  <SelectValue placeholder="Select camera">
                    {devices.find((d) => d.deviceId === selectedId)?.label ||
                      "Select camera"}
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
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1.5 text-xs"
                  onClick={stopStream}
                >
                  <VideoOff className="h-3.5 w-3.5" />
                  Stop
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleCapture}
                >
                  <Camera className="h-3.5 w-3.5" />
                  Capture
                </Button>
                {!isRecording ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={startVideoRecording}
                  >
                    <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                    Record
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs border-red-500/50"
                    onClick={stopVideoRecording}
                  >
                    <Square className="h-3 w-3 fill-red-500 text-red-500" />
                    {formatRecordingDuration(recordingTime)}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div>
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
                {devices.length > 0 && (
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
            {/* Recording indicator overlay */}
            {isRecording && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-2.5 py-1">
                <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500 animate-pulse" />
                <span className="text-xs text-white font-mono tabular-nums">
                  {formatRecordingDuration(recordingTime)}
                </span>
              </div>
            )}
          </div>

          {/* Diagnostic verdict */}
          {streaming && diagnostic && (
            <div
              className={`rounded-lg border px-4 py-3 space-y-2 ${
                diagnostic.status === "good"
                  ? "border-green-500/30 bg-green-500/5"
                  : diagnostic.status === "warning"
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-center gap-2">
                {diagnostic.status === "good" ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : diagnostic.status === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    diagnostic.status === "good"
                      ? "text-green-500"
                      : diagnostic.status === "warning"
                        ? "text-yellow-500"
                        : "text-red-500"
                  }`}
                >
                  {diagnostic.message}
                </span>
              </div>
              <div className="space-y-0.5">
                {diagnostic.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {item.ok ? (
                      <Check className="h-3 w-3 text-green-500 shrink-0" />
                    ) : (
                      <X className="h-3 w-3 text-red-400 shrink-0" />
                    )}
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device info + live stats */}
          {info && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                {
                  label: "Resolution",
                  value: `${info.width}\u00d7${info.height}`,
                },
                { label: "Frame Rate", value: `${info.frameRate} fps` },
                {
                  label: "Actual FPS",
                  value: actualFps > 0 ? `${Math.round(actualFps)} fps` : "...",
                },
                { label: "Aspect Ratio", value: info.aspectRatio },
                { label: "Facing", value: info.facingMode },
                { label: "Device", value: info.label },
                {
                  label: "Megapixels",
                  value: `${((info.width * info.height) / 1_000_000).toFixed(1)} MP`,
                },
                {
                  label: "Brightness",
                  value: brightnessInfo
                    ? brightnessInfo.label
                    : "...",
                  color:
                    brightnessInfo?.level === "good" ||
                    brightnessInfo?.level === "bright"
                      ? "text-green-500"
                      : brightnessInfo?.level === "dim"
                        ? "text-yellow-500"
                        : brightnessInfo?.level === "dark" ||
                            brightnessInfo?.level === "overexposed"
                          ? "text-red-500"
                          : undefined,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-muted/40 rounded-lg px-3 py-2"
                >
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {item.label}
                  </div>
                  <div
                    className={`text-sm font-medium mt-0.5 truncate ${
                      "color" in item && item.color ? item.color : ""
                    }`}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gallery — captures + video recordings unified */}
          {galleryItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Gallery
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {galleryItems.map((item) => {
                  if (item.type === "capture") {
                    const cap = item.data;
                    return (
                      <div
                        key={`cap-${cap.id}`}
                        className="group relative rounded-lg overflow-hidden border bg-black cursor-pointer"
                        onClick={() => setPreviewCap(cap)}
                      >
                        <img
                          src={cap.dataUrl}
                          alt="Captured frame"
                          className={`w-full aspect-video object-contain ${
                            mirrored ? "scale-x-[-1]" : ""
                          }`}
                        />
                        {/* Action buttons on hover */}
                        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCapture(cap);
                            }}
                            className="p-1.5 rounded-md bg-black/50 hover:bg-black/70 text-white transition-colors"
                          >
                            {copiedId === cap.id ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadCapture(cap);
                            }}
                            className="p-1.5 rounded-md bg-black/50 hover:bg-black/70 text-white transition-colors"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCapture(cap.id);
                            }}
                            className="p-1.5 rounded-md bg-black/50 hover:bg-black/70 text-white transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="absolute bottom-1.5 left-1.5 text-[10px] text-white/60 bg-black/40 rounded px-1.5 py-0.5">
                          <Camera className="h-2.5 w-2.5 inline mr-0.5 -mt-px" />
                          {cap.canvas.width}&times;{cap.canvas.height}
                        </div>
                      </div>
                    );
                  }

                  const rec = item.data;
                  return (
                    <div
                      key={`rec-${rec.id}`}
                      className="group relative rounded-lg overflow-hidden border bg-black"
                    >
                      {rec.thumbnail ? (
                        <img
                          src={rec.thumbnail}
                          alt="Video recording thumbnail"
                          className={`w-full aspect-video object-contain ${
                            mirrored ? "scale-x-[-1]" : ""
                          }`}
                        />
                      ) : (
                        <div className="w-full aspect-video flex items-center justify-center bg-muted/20">
                          <Video className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                      {/* Play button overlay (always visible) */}
                      <button
                        onClick={() => handlePlayRecording(rec)}
                        className="absolute inset-0 flex items-center justify-center group-hover:bg-black/30 transition-colors"
                      >
                        <div className="rounded-full bg-black/50 group-hover:bg-black/70 p-2.5 transition-colors">
                          <Play className="h-4 w-4 text-white ml-0.5" />
                        </div>
                      </button>
                      {/* Action buttons on hover */}
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadRecording(rec);
                          }}
                          className="p-1.5 rounded-md bg-black/50 hover:bg-black/70 text-white transition-colors"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRecording(rec.id);
                          }}
                          className="p-1.5 rounded-md bg-black/50 hover:bg-black/70 text-white transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      {/* Duration + size badge */}
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] text-white/80 bg-black/50 rounded px-1.5 py-0.5 font-mono tabular-nums">
                          <Video className="h-2.5 w-2.5 inline mr-0.5 -mt-px" />
                          {formatRecordingDuration(rec.duration)}
                        </span>
                        <span className="text-[10px] text-white/60 bg-black/40 rounded px-1.5 py-0.5">
                          {formatVideoSize(rec.blob.size)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Video playback dialog */}
      <Dialog
        open={!!playbackRec}
        onOpenChange={(open) => {
          if (!open) setPlaybackRec(null);
        }}
      >
        <DialogContent className="max-w-5xl w-[90vw] p-0 overflow-hidden gap-0">
          {playbackRec && (
            <>
              <video
                src={playbackRec.url}
                controls
                autoPlay
                className={`w-full aspect-video bg-black ${
                  mirrored ? "scale-x-[-1]" : ""
                }`}
              />
              <div className="flex items-center gap-3 px-4 py-2.5 border-t">
                <div className="flex-1 min-w-0 text-xs text-muted-foreground flex items-center gap-2">
                  <span className="font-mono tabular-nums">
                    {formatRecordingDuration(playbackRec.duration)}
                  </span>
                  <span>{formatVideoSize(playbackRec.blob.size)}</span>
                  <span>
                    {playbackRec.timestamp.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => handleDownloadRecording(playbackRec)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image preview dialog */}
      <Dialog
        open={!!previewCap}
        onOpenChange={(open) => {
          if (!open) setPreviewCap(null);
        }}
      >
        <DialogContent className="max-w-5xl w-[90vw] p-0 overflow-hidden gap-0">
          {previewCap && (
            <>
              <img
                src={previewCap.dataUrl}
                alt="Captured frame"
                className={`w-full aspect-video object-contain bg-black ${
                  mirrored ? "scale-x-[-1]" : ""
                }`}
              />
              <div className="flex items-center gap-3 px-4 py-2.5 border-t">
                <div className="flex-1 min-w-0 text-xs text-muted-foreground flex items-center gap-2">
                  <span>
                    {previewCap.canvas.width}&times;{previewCap.canvas.height}
                  </span>
                  <span>
                    {previewCap.timestamp.toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => handleCopyCapture(previewCap)}
                >
                  {copiedId === previewCap.id ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedId === previewCap.id ? "Copied" : "Copy"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => handleDownloadCapture(previewCap)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

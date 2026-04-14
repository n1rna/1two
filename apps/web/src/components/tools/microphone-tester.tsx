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
  Mic,
  MicOff,
  Circle,
  Square,
  Download,
  Trash2,
  Check,
  X,
  Info,
  Play,
  Pause,
  AudioLines,
  AlertTriangle,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  listAudioDevices,
  getAudioInfo,
  createAnalyser,
  getLevel,
  getFrequencyData,
  getNoiseLabel,
  diagnose,
  testEcho,
  extractWaveform,
  formatDuration,
  formatFileSize,
  type MicDevice,
  type MicInfo,
  type DiagResult,
} from "@/lib/tools/microphone";

interface Recording {
  id: number;
  blob: Blob;
  url: string;
  duration: number;
  deviceLabel: string;
  timestamp: Date;
  waveform: number[] | null;
}

let nextRecId = 0;

export function MicrophoneTester() {
  // === Core state ===
  const [devices, setDevices] = useState<MicDevice[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [listening, setListening] = useState(false);
  const [info, setInfo] = useState<MicInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rms, setRms] = useState(0);
  const [peak, setPeak] = useState(0);
  const [dbFS, setDbFS] = useState(-Infinity);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);

  // === Diagnostic state ===
  const [noiseFloorDb, setNoiseFloorDb] = useState(-Infinity);
  const [clipCount, setClipCount] = useState(0);
  const [signalSeen, setSignalSeen] = useState(false);
  const [diagReady, setDiagReady] = useState(false);
  const [echoResult, setEchoResult] = useState<{
    detected: boolean;
    strength: number;
  } | null>(null);
  const [echoTesting, setEchoTesting] = useState(false);

  // === Refs ===
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval>>(
    0 as unknown as ReturnType<typeof setInterval>
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const noiseFloorRef = useRef(-Infinity);
  const clipCountRef = useRef(0);
  const signalSeenRef = useRef(false);

  // === Lifecycle ===

  useEffect(() => {
    async function init() {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        tempStream.getTracks().forEach((t) => t.stop());
        const devs = await listAudioDevices();
        setDevices(devs);
        if (devs.length > 0) setSelectedId(devs[0].deviceId);
      } catch {
        setError("Microphone permission denied or no microphone found");
      }
    }
    init();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      cancelAnimationFrame(rafRef.current);
      clearInterval(recTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      recordings.forEach((r) => URL.revokeObjectURL(r.url));
    };
  }, []);

  // Diagnostic readiness timer
  useEffect(() => {
    if (!listening) {
      setDiagReady(false);
      return;
    }
    const timer = setTimeout(() => setDiagReady(true), 3000);
    return () => clearTimeout(timer);
  }, [listening]);

  // === Audio analysis ===

  const drawSpectrum = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const freqData = getFrequencyData(analyser);
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const barCount = 64;
    const step = Math.floor(freqData.length / barCount);
    const barWidth = w / barCount - 1;

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += freqData[i * step + j];
      }
      const avg = sum / step / 255;
      const barHeight = avg * h;

      const hue = 200 + i * (160 / barCount);
      ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.85)`;
      ctx.fillRect(i * (barWidth + 1), h - barHeight, barWidth, barHeight);
    }
  }, []);

  const tick = useCallback(() => {
    if (!analyserRef.current) return;
    const levels = getLevel(analyserRef.current);
    setRms(levels.rms);
    setPeak(levels.peak);
    setDbFS(levels.dbFS);

    // Track noise floor with exponential moving average
    if (levels.dbFS > -Infinity) {
      const current = noiseFloorRef.current;
      if (current === -Infinity) {
        noiseFloorRef.current = levels.dbFS;
      } else {
        // Track down quickly (quiet moments), track up slowly (speech/noise)
        const alpha = levels.rms < 0.15 ? 0.05 : 0.005;
        noiseFloorRef.current =
          levels.dbFS * alpha + current * (1 - alpha);
      }
      setNoiseFloorDb(noiseFloorRef.current);
    }

    // Track clipping
    if (levels.peak >= 0.99) {
      clipCountRef.current++;
      setClipCount(clipCountRef.current);
    }

    // Track signal presence
    if (!signalSeenRef.current && levels.rms > 0.05) {
      signalSeenRef.current = true;
      setSignalSeen(true);
    }

    drawSpectrum();
    rafRef.current = requestAnimationFrame(tick);
  }, [drawSpectrum]);

  // === Controls ===

  const startListening = useCallback(
    async (deviceId: string) => {
      setError(null);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
      cancelAnimationFrame(rafRef.current);

      // Reset diagnostics
      setNoiseFloorDb(-Infinity);
      noiseFloorRef.current = -Infinity;
      setClipCount(0);
      clipCountRef.current = 0;
      setSignalSeen(false);
      signalSeenRef.current = false;
      setEchoResult(null);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId } },
        });
        streamRef.current = stream;

        const { analyser, ctx: actx } = createAnalyser(stream);
        analyserRef.current = analyser;
        audioCtxRef.current = actx;

        const devs = await listAudioDevices();
        setDevices(devs);
        const label =
          devs.find((d) => d.deviceId === deviceId)?.label || "Microphone";
        setInfo(getAudioInfo(stream, label));
        setListening(true);

        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to access microphone"
        );
        setListening(false);
      }
    },
    [tick]
  );

  const stopListening = useCallback(() => {
    if (recording) stopRecording();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    cancelAnimationFrame(rafRef.current);
    setListening(false);
    setInfo(null);
    setRms(0);
    setPeak(0);
    setDbFS(-Infinity);
    setDiagReady(false);
  }, [recording]);

  const handleDeviceChange = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (listening) startListening(id);
    },
    [listening, startListening]
  );

  // === Recording ===

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const duration = (Date.now() - recStartRef.current) / 1000;
      const id = nextRecId++;
      setRecordings((prev) => [
        {
          id,
          blob,
          url,
          duration,
          deviceLabel: info?.label || "Microphone",
          timestamp: new Date(),
          waveform: null,
        },
        ...prev,
      ]);
      // Extract waveform asynchronously
      const waveform = await extractWaveform(blob);
      setRecordings((prev) =>
        prev.map((r) => (r.id === id ? { ...r, waveform } : r))
      );
    };
    recorderRef.current = recorder;
    recStartRef.current = Date.now();
    setRecordingTime(0);
    recorder.start(100);
    setRecording(true);

    recTimerRef.current = setInterval(() => {
      setRecordingTime((Date.now() - recStartRef.current) / 1000);
    }, 100);
  }, [info]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    clearInterval(recTimerRef.current);
    setRecording(false);
    setRecordingTime(0);
  }, []);

  const handlePlay = useCallback(
    (rec: Recording) => {
      if (playingId === rec.id) {
        audioElRef.current?.pause();
        setPlayingId(null);
        return;
      }
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
      const audio = new Audio(rec.url);
      audio.onended = () => setPlayingId(null);
      audio.play();
      audioElRef.current = audio;
      setPlayingId(rec.id);
    },
    [playingId]
  );

  const handleDownload = useCallback((rec: Recording) => {
    const a = document.createElement("a");
    a.href = rec.url;
    const ts = rec.timestamp.toISOString().replace(/[:.]/g, "-");
    a.download = `recording-${ts}.webm`;
    a.click();
  }, []);

  const handleDeleteRecording = useCallback(
    (id: number) => {
      if (playingId === id) {
        audioElRef.current?.pause();
        setPlayingId(null);
      }
      setRecordings((prev) => {
        const rec = prev.find((r) => r.id === id);
        if (rec) URL.revokeObjectURL(rec.url);
        return prev.filter((r) => r.id !== id);
      });
    },
    [playingId]
  );

  // === Echo test ===

  const handleEchoTest = useCallback(async () => {
    if (!audioCtxRef.current || !analyserRef.current) return;
    setEchoTesting(true);
    try {
      const result = await testEcho(
        audioCtxRef.current,
        analyserRef.current
      );
      setEchoResult(result);
    } catch {
      // Silently fail — echo test is optional
    } finally {
      setEchoTesting(false);
    }
  }, []);

  // === Computed ===

  const diagnostic: DiagResult | null = useMemo(() => {
    if (!diagReady) return null;
    return diagnose({
      hasSignal: signalSeen,
      noiseFloorDb,
      clipCount,
      echoResult,
    });
  }, [diagReady, signalSeen, noiseFloorDb, clipCount, echoResult]);

  const dbDisplay = dbFS === -Infinity ? "-\u221e" : `${Math.round(dbFS)}`;
  const noiseInfo =
    noiseFloorDb > -Infinity ? getNoiseLabel(noiseFloorDb) : null;

  // === Render ===

  return (
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <Mic className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Microphone Test</span>

          {listening && (
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
                  <SelectValue>
                    {devices.find((d) => d.deviceId === selectedId)?.label ||
                      "Select mic"}
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

            {!listening ? (
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => startListening(selectedId)}
                disabled={!selectedId}
              >
                <Mic className="h-3.5 w-3.5" />
                Start
              </Button>
            ) : (
              <>
                {!recording ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={startRecording}
                  >
                    <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                    Record
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs border-red-500/50"
                    onClick={stopRecording}
                  >
                    <Square className="h-3 w-3 fill-red-500 text-red-500" />
                    {formatDuration(recordingTime)}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1.5 text-xs"
                  onClick={stopListening}
                >
                  <MicOff className="h-3.5 w-3.5" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div>
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
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

          {/* Empty state */}
          {!listening && !error && (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <Mic className="h-10 w-10 mx-auto opacity-30" />
              <div className="text-sm">
                {devices.length === 0
                  ? "No microphones detected"
                  : "Click Start to begin testing your microphone"}
              </div>
              {devices.length > 0 && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => startListening(selectedId)}
                  disabled={!selectedId}
                >
                  <Mic className="h-3.5 w-3.5" />
                  Start Microphone
                </Button>
              )}
            </div>
          )}

          {/* Diagnostic verdict */}
          {listening && diagnostic && (
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
                {!echoTesting && (
                  <button
                    onClick={handleEchoTest}
                    className="flex items-center gap-2 text-xs text-primary/70 hover:text-primary transition-colors mt-1"
                  >
                    <AudioLines className="h-3 w-3 shrink-0" />
                    {echoResult ? "Re-test for echo" : "Test for echo (plays a brief tone)"}
                  </button>
                )}
                {echoTesting && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                    Testing for echo...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live meters */}
          {listening && (
            <>
              {/* Spectrum */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Frequency Spectrum
                </div>
                <div className="bg-muted/30 rounded-lg overflow-hidden border h-32">
                  <canvas ref={canvasRef} className="w-full h-full" />
                </div>
              </div>

              {/* Level meters */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Audio Levels
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Volume (RMS)
                      </span>
                      <span className="font-mono tabular-nums">
                        {Math.round(rms * 100)}%
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{
                          width: `${rms * 100}%`,
                          background:
                            rms > 0.8
                              ? "oklch(0.55 0.2 27)"
                              : rms > 0.5
                                ? "oklch(0.75 0.15 85)"
                                : "oklch(0.6 0.18 145)",
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Peak</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(peak * 100)}%
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-75"
                        style={{
                          width: `${peak * 100}%`,
                          background:
                            peak > 0.9
                              ? "oklch(0.55 0.2 27)"
                              : peak > 0.6
                                ? "oklch(0.75 0.15 85)"
                                : "oklch(0.6 0.18 145)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* dBFS + noise floor */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-muted/40 rounded-lg px-4 py-2 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      dBFS
                    </div>
                    <div className="text-lg font-mono font-bold tabular-nums mt-0.5">
                      {dbDisplay}
                    </div>
                  </div>
                  {noiseInfo && (
                    <div className="bg-muted/40 rounded-lg px-4 py-2 text-center">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Noise Floor
                      </div>
                      <div className="text-sm font-medium mt-0.5">
                        <span className="font-mono tabular-nums">
                          {Math.round(noiseFloorDb)} dB
                        </span>
                        <span
                          className={`ml-1.5 text-xs ${
                            noiseInfo.level === "silent" ||
                            noiseInfo.level === "quiet"
                              ? "text-green-500"
                              : noiseInfo.level === "moderate"
                                ? "text-yellow-500"
                                : "text-red-500"
                          }`}
                        >
                          {noiseInfo.label}
                        </span>
                      </div>
                    </div>
                  )}
                  {clipCount > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-center">
                      <div className="text-[10px] text-red-400 uppercase tracking-wide">
                        Clipping
                      </div>
                      <div className="text-sm font-mono font-bold text-red-500 mt-0.5">
                        {clipCount}&times;
                      </div>
                    </div>
                  )}
                  {recording && (
                    <div className="flex items-center gap-2 text-sm ml-auto">
                      <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
                      <span className="font-mono tabular-nums text-red-500">
                        {formatDuration(recordingTime)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Device info */}
              {info && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Device Info
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: "Device", value: info.label },
                      {
                        label: "Sample Rate",
                        value: info.sampleRate
                          ? `${(info.sampleRate / 1000).toFixed(1)} kHz`
                          : "N/A",
                      },
                      {
                        label: "Channels",
                        value: info.channelCount
                          ? String(info.channelCount)
                          : "N/A",
                      },
                      {
                        label: "Latency",
                        value: info.latency
                          ? `${(info.latency * 1000).toFixed(1)} ms`
                          : "N/A",
                      },
                      {
                        label: "Echo Cancel",
                        value: info.echoCancellation ? "On" : "Off",
                      },
                      {
                        label: "Noise Suppress",
                        value: info.noiseSuppression ? "On" : "Off",
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
                </div>
              )}
            </>
          )}

          {/* Recordings */}
          {recordings.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Recordings
              </div>
              <div className="space-y-1">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="group bg-muted/40 rounded-lg px-3 py-2 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handlePlay(rec)}
                        className="shrink-0 text-foreground hover:text-foreground/80 transition-colors"
                      >
                        {playingId === rec.id ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {rec.deviceLabel}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                          <span>{formatDuration(rec.duration)}</span>
                          <span>{formatFileSize(rec.blob.size)}</span>
                          <span>
                            {rec.timestamp.toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownload(rec)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRecording(rec.id)}
                          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Waveform */}
                    {rec.waveform && rec.waveform.length > 0 && (
                      <div className="flex items-center gap-[1px] h-8 mt-1.5 ml-7">
                        {rec.waveform.map((v, i) => (
                          <div
                            key={i}
                            className="flex-1 min-w-[1px] rounded-sm transition-colors"
                            style={{
                              height: `${Math.max(6, v * 100)}%`,
                              backgroundColor:
                                playingId === rec.id
                                  ? "oklch(0.6 0.18 250 / 0.7)"
                                  : "oklch(0.55 0 0 / 0.2)",
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

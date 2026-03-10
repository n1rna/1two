"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Volume,
  Maximize,
  Minimize,
  Upload,
  Link,
  X,
  Loader2,
  AlertCircle,
  Film,
  MonitorPlay,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────

interface PlayerState {
  loaded: boolean;
  loading: boolean;
  playing: boolean;
  duration: number;
  error: string | null;
  warning: string | null;
  fileName: string;
  hasVideo: boolean;
  hasAudio: boolean;
}

// ── Helpers ───────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  seconds = Math.round(seconds * 1000) / 1000;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((1000 * seconds) % 1000)
    .toString()
    .padStart(3, "0");
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${ms}`;
}

const VolumeIcon = ({ level, muted }: { level: number; muted: boolean }) => {
  if (muted || level === 0) return <VolumeX className="h-4 w-4" />;
  if (level < 0.33) return <Volume className="h-4 w-4" />;
  if (level < 0.66) return <Volume1 className="h-4 w-4" />;
  return <Volume2 className="h-4 w-4" />;
};

// ── Component ─────────────────────────────────────────

export function VideoPlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // All mutable player internals in a single ref to avoid stale closures
  const engine = useRef<{
    videoSink: unknown;
    audioSink: unknown;
    audioContext: AudioContext | null;
    gainNode: GainNode | null;
    videoFrameIterator: AsyncGenerator | null;
    audioBufferIterator: AsyncGenerator<{ buffer: AudioBuffer; timestamp: number }> | null;
    nextFrame: { canvas: HTMLCanvasElement; timestamp: number } | null;
    queuedAudioNodes: Set<AudioBufferSourceNode>;
    asyncId: number;
    playing: boolean;
    totalDuration: number;
    playbackTimeAtStart: number;
    audioContextStartTime: number | null;
    volume: number;
    muted: boolean;
    draggingProgress: boolean;
    draggingVolume: boolean;
    animFrameId: number | null;
    intervalId: ReturnType<typeof setInterval> | null;
  }>({
    videoSink: null,
    audioSink: null,
    audioContext: null,
    gainNode: null,
    videoFrameIterator: null,
    audioBufferIterator: null,
    nextFrame: null,
    queuedAudioNodes: new Set(),
    asyncId: 0,
    playing: false,
    totalDuration: 0,
    playbackTimeAtStart: 0,
    audioContextStartTime: null,
    volume: 0.7,
    muted: false,
    draggingProgress: false,
    draggingVolume: false,
    animFrameId: null,
    intervalId: null,
  });

  const [state, setState] = useState<PlayerState>({
    loaded: false,
    loading: false,
    playing: false,
    duration: 0,
    error: null,
    warning: null,
    fileName: "",
    hasVideo: true,
    hasAudio: true,
  });
  const [source, setSource] = useState<File | string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);

  // ── Engine methods ──────────────────────────────────

  const getPlaybackTime = useCallback(() => {
    const e = engine.current;
    if (e.playing && e.audioContext && e.audioContextStartTime !== null) {
      return e.audioContext.currentTime - e.audioContextStartTime + e.playbackTimeAtStart;
    }
    return e.playbackTimeAtStart;
  }, []);

  const updateVolume = useCallback(() => {
    const e = engine.current;
    if (!e.gainNode) return;
    const actual = e.muted ? 0 : e.volume;
    e.gainNode.gain.value = actual ** 2;
  }, []);

  const startVideoIterator = useCallback(async () => {
    const e = engine.current;
    if (!e.videoSink) return;

    e.asyncId++;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sink = e.videoSink as any;

    await e.videoFrameIterator?.return(undefined);

    e.videoFrameIterator = sink.canvases(getPlaybackTime());

    const first = (await e.videoFrameIterator!.next()).value ?? null;
    const second = (await e.videoFrameIterator!.next()).value ?? null;

    e.nextFrame = second;

    if (first) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(first.canvas, 0, 0);
        }
      }
    }
  }, [getPlaybackTime]);

  const updateNextFrame = useCallback(async () => {
    const e = engine.current;
    const currentAsyncId = e.asyncId;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    while (true) {
      const result = await e.videoFrameIterator!.next();
      const newFrame = result.value ?? null;
      if (!newFrame) break;
      if (currentAsyncId !== e.asyncId) break;

      const playbackTime = getPlaybackTime();
      if (newFrame.timestamp <= playbackTime) {
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(newFrame.canvas, 0, 0);
        }
      } else {
        e.nextFrame = newFrame;
        break;
      }
    }
  }, [getPlaybackTime]);

  const runAudioIterator = useCallback(async () => {
    const e = engine.current;
    if (!e.audioSink || !e.audioBufferIterator) return;

    for await (const { buffer, timestamp } of e.audioBufferIterator) {
      const node = e.audioContext!.createBufferSource();
      node.buffer = buffer;
      node.connect(e.gainNode!);

      const startTimestamp = e.audioContextStartTime! + timestamp - e.playbackTimeAtStart;

      if (startTimestamp >= e.audioContext!.currentTime) {
        node.start(startTimestamp);
      } else {
        node.start(e.audioContext!.currentTime, e.audioContext!.currentTime - startTimestamp);
      }

      e.queuedAudioNodes.add(node);
      node.onended = () => e.queuedAudioNodes.delete(node);

      if (timestamp - getPlaybackTime() >= 1) {
        await new Promise<void>((resolve) => {
          const id = setInterval(() => {
            if (timestamp - getPlaybackTime() < 1) {
              clearInterval(id);
              resolve();
            }
          }, 100);
        });
      }
    }
  }, [getPlaybackTime]);

  const play = useCallback(async () => {
    const e = engine.current;
    if (!e.audioContext) return;

    if (e.audioContext.state === "suspended") {
      await e.audioContext.resume();
    }

    if (getPlaybackTime() >= e.totalDuration) {
      e.playbackTimeAtStart = 0;
      await startVideoIterator();
    }

    e.audioContextStartTime = e.audioContext.currentTime;
    e.playing = true;
    setPlaying(true);

    if (e.audioSink) {
      await e.audioBufferIterator?.return(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      e.audioBufferIterator = (e.audioSink as any).buffers(getPlaybackTime());
      void runAudioIterator();
    }
  }, [getPlaybackTime, startVideoIterator, runAudioIterator]);

  const pause = useCallback(() => {
    const e = engine.current;
    e.playbackTimeAtStart = getPlaybackTime();
    e.playing = false;
    setPlaying(false);

    void e.audioBufferIterator?.return(undefined);
    e.audioBufferIterator = null;

    for (const node of e.queuedAudioNodes) {
      node.stop();
    }
    e.queuedAudioNodes.clear();
  }, [getPlaybackTime]);

  const togglePlay = useCallback(() => {
    if (engine.current.playing) {
      pause();
    } else {
      void play();
    }
  }, [play, pause]);

  const seekToTime = useCallback(
    async (seconds: number) => {
      const e = engine.current;
      const wasPlaying = e.playing;

      if (wasPlaying) pause();
      e.playbackTimeAtStart = seconds;
      setCurrentTime(seconds);

      await startVideoIterator();

      if (wasPlaying && e.playbackTimeAtStart < e.totalDuration) {
        void play();
      }
    },
    [pause, play, startVideoIterator]
  );

  // ── Render loop ─────────────────────────────────────

  useEffect(() => {
    const e = engine.current;

    const render = () => {
      if (e.playing || e.videoSink) {
        const t = getPlaybackTime();

        if (t >= e.totalDuration && e.playing) {
          pause();
          e.playbackTimeAtStart = e.totalDuration;
        }

        if (e.nextFrame && e.nextFrame.timestamp <= t) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (ctx && canvas) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(e.nextFrame.canvas, 0, 0);
          }
          e.nextFrame = null;
          void updateNextFrame();
        }

        if (!e.draggingProgress) {
          setCurrentTime(t);
        }
      }

      e.animFrameId = requestAnimationFrame(render);
    };

    e.animFrameId = requestAnimationFrame(render);
    e.intervalId = setInterval(() => {
      if (e.playing && !e.draggingProgress) {
        setCurrentTime(getPlaybackTime());
      }
    }, 500);

    return () => {
      if (e.animFrameId) cancelAnimationFrame(e.animFrameId);
      if (e.intervalId) clearInterval(e.intervalId);
    };
  }, [getPlaybackTime, pause, updateNextFrame]);

  // ── Init media ──────────────────────────────────────

  const initMedia = useCallback(
    async (resource: File | string) => {
      const e = engine.current;

      // Dispose previous
      if (e.playing) pause();
      await e.videoFrameIterator?.return(undefined);
      await e.audioBufferIterator?.return(undefined);
      e.asyncId++;
      e.videoSink = null;
      e.audioSink = null;

      setState({
        loaded: false,
        loading: true,
        playing: false,
        duration: 0,
        error: null,
        warning: null,
        fileName: resource instanceof File ? resource.name : resource.split("/").pop()?.split("?")[0] || "Remote video",
        hasVideo: true,
        hasAudio: true,
      });
      setSource(resource);
      setCurrentTime(0);
      setPlaying(false);

      try {
        const {
          Input: MBInput,
          ALL_FORMATS,
          BlobSource,
          UrlSource,
          CanvasSink,
          AudioBufferSink,
        } = await import("mediabunny");

        const mbSource =
          resource instanceof File
            ? new BlobSource(resource)
            : new UrlSource(resource);

        const input = new MBInput({ source: mbSource, formats: ALL_FORMATS });

        e.playbackTimeAtStart = 0;
        e.totalDuration = await input.computeDuration();

        let videoTrack = await input.getPrimaryVideoTrack().catch(() => null);
        let audioTrack = await input.getPrimaryAudioTrack().catch(() => null);

        let warning = "";

        if (videoTrack) {
          if (videoTrack.codec === null) {
            warning += "Unsupported video codec. ";
            videoTrack = null;
          } else if (!(await videoTrack.canDecode())) {
            warning += "Unable to decode the video track. ";
            videoTrack = null;
          }
        }

        if (audioTrack) {
          if (audioTrack.codec === null) {
            warning += "Unsupported audio codec. ";
            audioTrack = null;
          } else if (!(await audioTrack.canDecode())) {
            warning += "Unable to decode the audio track. ";
            audioTrack = null;
          }
        }

        if (!videoTrack && !audioTrack) {
          throw new Error(warning || "No audio or video track found.");
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        e.audioContext = new AC({ sampleRate: audioTrack?.sampleRate });
        e.gainNode = e.audioContext.createGain();
        e.gainNode.connect(e.audioContext.destination);
        updateVolume();

        if (videoTrack) {
          const canBeTransparent = await videoTrack.canBeTransparent();
          e.videoSink = new CanvasSink(videoTrack, {
            poolSize: 2,
            fit: "contain",
            alpha: canBeTransparent,
          });

          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = videoTrack.displayWidth;
            canvas.height = videoTrack.displayHeight;
          }
        }

        if (audioTrack) {
          e.audioSink = new AudioBufferSink(audioTrack);
        }

        await startVideoIterator();

        setState({
          loaded: true,
          loading: false,
          playing: false,
          duration: e.totalDuration,
          error: null,
          warning: warning || null,
          fileName:
            resource instanceof File
              ? resource.name
              : resource.split("/").pop()?.split("?")[0] || "Remote video",
          hasVideo: !!videoTrack,
          hasAudio: !!audioTrack,
        });

        // Auto-play if audio context allows
        if (e.audioContext.state === "running") {
          void play();
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: String(err instanceof Error ? err.message : err),
        }));
      }
    },
    [pause, startVideoIterator, play, updateVolume]
  );

  // ── File/URL loading ────────────────────────────────

  const loadFile = useCallback(
    (file: File) => {
      setShowUrlInput(false);
      void initMedia(file);
    },
    [initMedia]
  );

  const loadUrl = useCallback(() => {
    const url = urlInput.trim();
    if (!url) return;
    setShowUrlInput(false);
    void initMedia(url);
  }, [urlInput, initMedia]);

  // ── Controls ────────────────────────────────────────

  const handleVolumeChange = useCallback(
    (val: number) => {
      engine.current.volume = val;
      engine.current.muted = false;
      setVolume(val);
      setMuted(false);
      updateVolume();
    },
    [updateVolume]
  );

  const toggleMute = useCallback(() => {
    engine.current.muted = !engine.current.muted;
    setMuted(engine.current.muted);
    updateVolume();
  }, [updateVolume]);

  const toggleFullscreen = useCallback(async () => {
    const el = playerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (!engine.current.draggingProgress && !engine.current.draggingVolume) {
        setShowControls(false);
      }
    }, 2000);
  }, []);

  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
  }, [playing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!state.loaded) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.code) {
        case "Space":
        case "KeyK":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          void seekToTime(Math.max(getPlaybackTime() - 5, 0));
          break;
        case "ArrowRight":
          e.preventDefault();
          void seekToTime(
            Math.min(getPlaybackTime() + 5, engine.current.totalDuration)
          );
          break;
        case "KeyM":
          toggleMute();
          break;
        case "KeyF":
          void toggleFullscreen();
          break;
        default:
          return;
      }
      showControlsTemporarily();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    state.loaded,
    togglePlay,
    seekToTime,
    getPlaybackTime,
    toggleMute,
    toggleFullscreen,
    showControlsTemporarily,
  ]);

  // Drag and drop
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  // Progress bar
  const handleProgressDown = useCallback(
    (e: React.PointerEvent) => {
      const bar = progressRef.current;
      if (!bar || !state.duration) return;
      engine.current.draggingProgress = true;

      const update = (clientX: number) => {
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        setCurrentTime(ratio * state.duration);
      };

      update(e.clientX);

      const onMove = (ev: PointerEvent) => update(ev.clientX);
      const onUp = (ev: PointerEvent) => {
        engine.current.draggingProgress = false;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        void seekToTime(ratio * state.duration);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        showControlsTemporarily();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [state.duration, seekToTime, showControlsTemporarily]
  );

  // Volume bar
  const handleVolumeDown = useCallback(
    (e: React.PointerEvent) => {
      const bar = volumeRef.current;
      if (!bar) return;
      engine.current.draggingVolume = true;

      const update = (clientX: number) => {
        const rect = bar.getBoundingClientRect();
        const val = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        handleVolumeChange(val);
      };

      update(e.clientX);

      const onMove = (ev: PointerEvent) => update(ev.clientX);
      const onUp = () => {
        engine.current.draggingVolume = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        showControlsTemporarily();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [handleVolumeChange, showControlsTemporarily]
  );

  const progressPct = state.duration > 0 ? (currentTime / state.duration) * 100 : 0;
  const volumePct = muted ? 0 : volume * 100;

  // Close/reset
  const handleClose = useCallback(() => {
    const e = engine.current;
    if (e.playing) pause();
    void e.videoFrameIterator?.return(undefined);
    void e.audioBufferIterator?.return(undefined);
    e.videoSink = null;
    e.audioSink = null;
    e.audioContext?.close();
    e.audioContext = null;
    setSource(null);
    setState({
      loaded: false,
      loading: false,
      playing: false,
      duration: 0,
      error: null,
      warning: null,
      fileName: "",
      hasVideo: true,
      hasAudio: true,
    });
    setCurrentTime(0);
    setPlaying(false);
  }, [pause]);

  // ── No source - landing ─────────────────────────────

  if (!source) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="border-b shrink-0">
          <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
            <MonitorPlay className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Video Player</span>
          </div>
        </div>

        <div
          className="flex-1 flex items-center justify-center p-6"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div
            className={`w-full max-w-lg rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold mb-1">Open a video</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Drag & drop a video file, browse your files, or enter a URL
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Browse Files
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowUrlInput(true)}
                className="gap-2"
              >
                <Link className="h-4 w-4" />
                Enter URL
              </Button>
            </div>

            {showUrlInput && (
              <div className="flex items-center gap-2 mt-4 max-w-sm mx-auto">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadUrl()}
                  placeholder="https://example.com/video.mp4"
                  className="text-sm"
                  autoFocus
                />
                <Button size="sm" onClick={loadUrl}>
                  Load
                </Button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,video/x-matroska,video/mp2t,.ts,audio/*,audio/aac"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) loadFile(f);
              }}
              className="hidden"
            />

            <div className="mt-6 text-xs text-muted-foreground/60">
              Supports MP4, WebM, MKV, MOV, OGG, MPEG-TS, and more
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Player view ─────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black">
      {/* Toolbar */}
      <div className="border-b border-white/10 shrink-0 bg-black/80 backdrop-blur z-20">
        <div className="flex items-center gap-2 px-4 py-1.5">
          <MonitorPlay className="h-4 w-4 text-white/60" />
          <span className="text-sm font-semibold text-white/80 truncate flex-1 min-w-0">
            {state.fileName}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => fileInputRef.current?.click()}
              title="Open file"
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setShowUrlInput((v) => !v)}
              title="Open URL"
            >
              <Link className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-white/70 hover:text-white hover:bg-white/10"
              onClick={handleClose}
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {showUrlInput && (
          <div className="flex items-center gap-2 px-4 pb-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadUrl()}
              placeholder="https://example.com/video.mp4"
              className="text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30"
              autoFocus
            />
            <Button size="sm" onClick={loadUrl}>
              Load
            </Button>
          </div>
        )}
      </div>

      {/* Player area */}
      <div
        ref={playerRef}
        className="flex-1 min-h-0 relative flex items-center justify-center select-none bg-black"
        onMouseMove={showControlsTemporarily}
        onMouseLeave={() => {
          if (
            !engine.current.draggingProgress &&
            !engine.current.draggingVolume
          ) {
            setShowControls(false);
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="max-w-full max-h-full w-auto h-auto cursor-pointer"
          style={{ display: state.hasVideo && state.loaded ? "" : "none" }}
          onClick={togglePlay}
        />

        {/* Audio-only placeholder */}
        {!state.hasVideo && state.loaded && (
          <div
            className="flex flex-col items-center justify-center gap-3 cursor-pointer"
            onClick={togglePlay}
          >
            <Volume2 className="h-16 w-16 text-white/20" />
            <span className="text-white/40 text-sm">Audio only</span>
          </div>
        )}

        {/* Loading */}
        {state.loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="h-10 w-10 text-white/80 animate-spin" />
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center p-6 max-w-md">
              <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <p className="text-white/80 text-sm">{state.error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-white border-white/20 hover:bg-white/10"
                onClick={handleClose}
              >
                Try another file
              </Button>
            </div>
          </div>
        )}

        {/* Warning */}
        {state.warning && state.loaded && (
          <div className="absolute top-3 left-3 bg-amber-500/20 backdrop-blur rounded-lg px-3 py-2 text-amber-300 text-xs max-w-xs z-10">
            {state.warning}
          </div>
        )}

        {/* Drag overlay */}
        {dragging && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-20 pointer-events-none">
            <span className="text-white text-lg font-medium">
              Drop to load video
            </span>
          </div>
        )}

        {/* Controls */}
        {state.loaded && (
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-16 pb-2 px-3 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Progress bar */}
            <div
              ref={progressRef}
              className="group relative h-1.5 hover:h-2.5 transition-all cursor-pointer mb-2 rounded-full touch-none"
              onPointerDown={handleProgressDown}
            >
              <div className="absolute inset-0 rounded-full bg-white/20" />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-white/70 group-hover:bg-white"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="absolute top-1/2 w-4 h-4 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  left: `${progressPct}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-1">
              <button
                onClick={togglePlay}
                className="p-1.5 text-white hover:scale-110 transition-transform"
                title="Play/Pause (Space)"
              >
                {playing ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </button>

              {/* Volume */}
              {state.hasAudio && (
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    onClick={toggleMute}
                    className="p-1.5 text-white/70 hover:text-white transition-colors"
                    title="Mute (M)"
                  >
                    <VolumeIcon level={volume} muted={muted} />
                  </button>
                  <div
                    ref={volumeRef}
                    className="w-16 relative rounded-full bg-white/20 h-1.5 group cursor-pointer touch-none"
                    onPointerDown={handleVolumeDown}
                  >
                    <div
                      className="absolute h-full top-0 left-0 rounded-full bg-white/70 group-hover:bg-white"
                      style={{ width: `${volumePct}%` }}
                    />
                    <div
                      className="absolute top-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        left: `${volumePct}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Time */}
              <span className="text-white/70 text-xs font-mono ml-2 tabular-nums">
                {formatTime(currentTime)}
              </span>

              <div className="flex-1" />

              <span className="text-white/70 text-xs font-mono tabular-nums">
                {formatTime(state.duration)}
              </span>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 text-white/70 hover:text-white transition-colors"
                title="Fullscreen (F)"
              >
                {isFullscreen ? (
                  <Minimize className="h-4 w-4" />
                ) : (
                  <Maximize className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,video/x-matroska,video/mp2t,.ts,audio/*,audio/aac"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFile(f);
        }}
        className="hidden"
      />
    </div>
  );
}

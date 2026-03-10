"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileVideo,
  Upload,
  X,
  Loader2,
  Download,
  Info,
  Shrink,
  ArrowRightLeft,
  Film,
  Check,
  AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────

interface MediaMeta {
  format: string;
  mimeType: string;
  duration: number | null;
  fileSize: number;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  audioChannels: number | null;
  audioSampleRate: number | null;
  trackCount: number;
}

type OutputFormat = "mp4" | "webm" | "mov";
type VideoCodec = "avc" | "vp9" | "av1";
type AudioCodec = "aac" | "opus";
type QualityPreset = "high" | "medium" | "low" | "custom";

interface ConvertSettings {
  outputFormat: OutputFormat;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec;
  resolution: string;
  videoBitrate: string;
  audioBitrate: string;
}

interface CompressSettings {
  quality: QualityPreset;
  maxWidth: string;
  videoBitrate: string;
  audioBitrate: string;
  frameRate: string;
}

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "mp4", label: "MP4" },
  { value: "webm", label: "WebM" },
  { value: "mov", label: "MOV" },
];

const VIDEO_CODEC_OPTIONS: { value: VideoCodec; label: string; formats: OutputFormat[] }[] = [
  { value: "avc", label: "H.264 (AVC)", formats: ["mp4", "mov"] },
  { value: "vp9", label: "VP9", formats: ["webm"] },
  { value: "av1", label: "AV1", formats: ["mp4", "webm"] },
];

const AUDIO_CODEC_OPTIONS: { value: AudioCodec; label: string; formats: OutputFormat[] }[] = [
  { value: "aac", label: "AAC", formats: ["mp4", "mov"] },
  { value: "opus", label: "Opus", formats: ["webm"] },
];

const RESOLUTION_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "3840", label: "4K (3840)" },
  { value: "1920", label: "1080p (1920)" },
  { value: "1280", label: "720p (1280)" },
  { value: "854", label: "480p (854)" },
  { value: "640", label: "360p (640)" },
];

const VIDEO_BITRATE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "20000000", label: "20 Mbps" },
  { value: "10000000", label: "10 Mbps" },
  { value: "5000000", label: "5 Mbps" },
  { value: "2500000", label: "2.5 Mbps" },
  { value: "1000000", label: "1 Mbps" },
  { value: "500000", label: "500 Kbps" },
];

const AUDIO_BITRATE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "320000", label: "320 Kbps" },
  { value: "192000", label: "192 Kbps" },
  { value: "128000", label: "128 Kbps" },
  { value: "96000", label: "96 Kbps" },
  { value: "64000", label: "64 Kbps" },
];

const FRAME_RATE_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "60", label: "60 fps" },
  { value: "30", label: "30 fps" },
  { value: "24", label: "24 fps" },
  { value: "15", label: "15 fps" },
];

const QUALITY_PRESETS: Record<QualityPreset, { label: string; description: string }> = {
  high: { label: "High Quality", description: "Minimal compression, large file" },
  medium: { label: "Balanced", description: "Good quality, moderate file size" },
  low: { label: "Small File", description: "Smaller file, reduced quality" },
  custom: { label: "Custom", description: "Set your own parameters" },
};

// ── Helpers ───────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds)) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getDefaultVideoCodec(format: OutputFormat): VideoCodec {
  if (format === "webm") return "vp9";
  return "avc";
}

function getDefaultAudioCodec(format: OutputFormat): AudioCodec {
  if (format === "webm") return "opus";
  return "aac";
}

function getCompatibleVideoCodecs(format: OutputFormat) {
  return VIDEO_CODEC_OPTIONS.filter((c) => c.formats.includes(format));
}

function getCompatibleAudioCodecs(format: OutputFormat) {
  return AUDIO_CODEC_OPTIONS.filter((c) => c.formats.includes(format));
}

function qualityToBitrates(quality: QualityPreset): { video: number; audio: number } {
  switch (quality) {
    case "high": return { video: 10_000_000, audio: 192_000 };
    case "medium": return { video: 2_500_000, audio: 128_000 };
    case "low": return { video: 800_000, audio: 96_000 };
    default: return { video: 2_500_000, audio: 128_000 };
  }
}

// ── Component ─────────────────────────────────────────

export function VideoConverter() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState("info");

  // Metadata
  const [meta, setMeta] = useState<MediaMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Processing
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processError, setProcessError] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState("");

  // Convert settings
  const [convertSettings, setConvertSettings] = useState<ConvertSettings>({
    outputFormat: "mp4",
    videoCodec: "avc",
    audioCodec: "aac",
    resolution: "original",
    videoBitrate: "auto",
    audioBitrate: "auto",
  });

  // Compress settings
  const [compressSettings, setCompressSettings] = useState<CompressSettings>({
    quality: "medium",
    maxWidth: "original",
    videoBitrate: "2500000",
    audioBitrate: "128000",
    frameRate: "original",
  });

  const loadFile = useCallback(async (f: File) => {
    setFile(f);
    setMeta(null);
    setMetaError(null);
    setMetaLoading(true);
    setResultBlob(null);
    setProcessError(null);
    setTab("info");

    try {
      const { Input: MBInput, ALL_FORMATS, BlobSource } = await import("mediabunny");
      const input = new MBInput({
        source: new BlobSource(f),
        formats: ALL_FORMATS,
      });

      const [format, mimeType, videoTrack, audioTrack, tracks] = await Promise.all([
        input.getFormat().catch(() => null),
        input.getMimeType().catch(() => null),
        input.getPrimaryVideoTrack().catch(() => null),
        input.getPrimaryAudioTrack().catch(() => null),
        input.getTracks().catch(() => []),
      ]);

      let dur: number | null = null;
      try {
        dur = (await input.computeDuration()) ?? null;
      } catch {}

      setMeta({
        format: format?.constructor?.name?.replace("Format", "") || "Unknown",
        mimeType: mimeType || "Unknown",
        duration: dur,
        fileSize: f.size,
        videoCodec: videoTrack?.codec || null,
        audioCodec: audioTrack?.codec || null,
        width: videoTrack?.displayWidth || null,
        height: videoTrack?.displayHeight || null,
        frameRate: (videoTrack as unknown as Record<string, unknown>)?.frameRate as number | null ?? null,
        audioChannels: audioTrack?.numberOfChannels || null,
        audioSampleRate: audioTrack?.sampleRate || null,
        trackCount: tracks.length,
      });
    } catch {
      setMetaError("Could not read file metadata. The format may be unsupported.");
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) loadFile(f);
    },
    [loadFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) loadFile(f);
    },
    [loadFile]
  );

  const runConversion = useCallback(
    async (mode: "convert" | "compress") => {
      if (!file) return;
      setProcessing(true);
      setProgress(0);
      setProcessError(null);
      setResultBlob(null);

      try {
        const {
          Input: MBInput,
          Output: MBOutput,
          Conversion,
          Mp4OutputFormat,
          WebMOutputFormat,
          MovOutputFormat,
          BufferTarget,
          ALL_FORMATS,
          BlobSource,
        } = await import("mediabunny");

        const input = new MBInput({
          source: new BlobSource(file),
          formats: ALL_FORMATS,
        });

        let outputFormat: OutputFormat;
        let vCodec: VideoCodec;
        let aCodec: AudioCodec;
        let resWidth: number | undefined;
        let vBitrate: number | undefined;
        let aBitrate: number | undefined;
        let fps: number | undefined;

        if (mode === "convert") {
          outputFormat = convertSettings.outputFormat;
          vCodec = convertSettings.videoCodec;
          aCodec = convertSettings.audioCodec;
          resWidth = convertSettings.resolution === "original" ? undefined : parseInt(convertSettings.resolution);
          vBitrate = convertSettings.videoBitrate === "auto" ? undefined : parseInt(convertSettings.videoBitrate);
          aBitrate = convertSettings.audioBitrate === "auto" ? undefined : parseInt(convertSettings.audioBitrate);
        } else {
          outputFormat = "mp4";
          vCodec = "avc";
          aCodec = "aac";

          if (compressSettings.quality === "custom") {
            resWidth = compressSettings.maxWidth === "original" ? undefined : parseInt(compressSettings.maxWidth);
            vBitrate = parseInt(compressSettings.videoBitrate);
            aBitrate = parseInt(compressSettings.audioBitrate);
            fps = compressSettings.frameRate === "original" ? undefined : parseInt(compressSettings.frameRate);
          } else {
            const presets = qualityToBitrates(compressSettings.quality);
            vBitrate = presets.video;
            aBitrate = presets.audio;
            resWidth = compressSettings.maxWidth === "original" ? undefined : parseInt(compressSettings.maxWidth);
            fps = compressSettings.frameRate === "original" ? undefined : parseInt(compressSettings.frameRate);
          }
        }

        const formatMap = {
          mp4: () => new Mp4OutputFormat({ fastStart: "in-memory" }),
          webm: () => new WebMOutputFormat(),
          mov: () => new MovOutputFormat({ fastStart: "in-memory" }),
        };

        const target = new BufferTarget();
        const output = new MBOutput({
          format: formatMap[outputFormat](),
          target,
        });

        const videoOpts: Record<string, unknown> = {};
        if (resWidth) videoOpts.width = resWidth;
        if (vBitrate) videoOpts.bitrate = vBitrate;
        if (fps) videoOpts.frameRate = fps;
        videoOpts.codec = vCodec;

        const audioOpts: Record<string, unknown> = {};
        if (aBitrate) audioOpts.bitrate = aBitrate;
        audioOpts.codec = aCodec;

        const conversion = await Conversion.init({
          input,
          output,
          video: Object.keys(videoOpts).length > 0 ? videoOpts : undefined,
          audio: Object.keys(audioOpts).length > 0 ? audioOpts : undefined,
        });

        if (!conversion.isValid) {
          setProcessError("Cannot process this file - codec or format combination not supported.");
          setProcessing(false);
          return;
        }

        conversion.onProgress = (p: number) => setProgress(p);
        await conversion.execute();

        const buf = target.buffer;
        if (!buf) {
          setProcessError("Processing produced no output.");
          setProcessing(false);
          return;
        }

        const mimeMap = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
        const extMap = { mp4: "mp4", webm: "webm", mov: "mov" };
        const blob = new Blob([buf], { type: mimeMap[outputFormat] });
        setResultBlob(blob);

        const baseName = file.name.replace(/\.[^.]+$/, "");
        setResultName(`${baseName}.${extMap[outputFormat]}`);
      } catch (err) {
        setProcessError(
          `Processing failed: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      } finally {
        setProcessing(false);
      }
    },
    [file, convertSettings, compressSettings]
  );

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = resultName;
    a.click();
    URL.revokeObjectURL(url);
  }, [resultBlob, resultName]);

  // Auto-fix codec when format changes
  useEffect(() => {
    const compatible = getCompatibleVideoCodecs(convertSettings.outputFormat);
    if (!compatible.find((c) => c.value === convertSettings.videoCodec)) {
      setConvertSettings((s) => ({
        ...s,
        videoCodec: getDefaultVideoCodec(s.outputFormat),
      }));
    }
    const compatAudio = getCompatibleAudioCodecs(convertSettings.outputFormat);
    if (!compatAudio.find((c) => c.value === convertSettings.audioCodec)) {
      setConvertSettings((s) => ({
        ...s,
        audioCodec: getDefaultAudioCodec(s.outputFormat),
      }));
    }
  }, [convertSettings.outputFormat, convertSettings.videoCodec, convertSettings.audioCodec]);

  // No file - show landing
  if (!file) {
    return (
      <div className="flex flex-col overflow-hidden">
        <div className="border-b shrink-0">
          <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
            <FileVideo className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Video Converter</span>
          </div>
        </div>

        <div
          className="flex items-center justify-center py-24 px-6"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div
            className={`w-full max-w-lg rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <Film className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold mb-1">Open a video file</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Drag & drop a video or browse to get started
            </p>
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              Browse Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*"
              onChange={handleFileInput}
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <FileVideo className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold truncate flex-1 min-w-0">{file.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatFileSize(file.size)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => fileInputRef.current?.click()}
            title="Open another file"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => {
              setFile(null);
              setMeta(null);
              setMetaError(null);
              setResultBlob(null);
              setProcessError(null);
            }}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1 gap-1.5">
                <Info className="h-3.5 w-3.5" /> Info
              </TabsTrigger>
              <TabsTrigger value="convert" className="flex-1 gap-1.5">
                <ArrowRightLeft className="h-3.5 w-3.5" /> Convert
              </TabsTrigger>
              <TabsTrigger value="compress" className="flex-1 gap-1.5">
                <Shrink className="h-3.5 w-3.5" /> Compress
              </TabsTrigger>
            </TabsList>

            {/* ── Info Tab ──────────────────────── */}
            <TabsContent value="info" className="mt-4 space-y-4">
              {metaLoading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Reading metadata...</span>
                </div>
              )}

              {metaError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {metaError}
                </div>
              )}

              {meta && (
                <div className="space-y-4">
                  {/* General */}
                  <MetaSection title="General">
                    <MetaRow label="File Name" value={file.name} />
                    <MetaRow label="File Size" value={formatFileSize(meta.fileSize)} />
                    <MetaRow label="Container" value={meta.format} />
                    <MetaRow label="MIME Type" value={meta.mimeType} />
                    <MetaRow label="Duration" value={formatDuration(meta.duration)} />
                    <MetaRow label="Tracks" value={String(meta.trackCount)} />
                  </MetaSection>

                  {/* Video */}
                  {meta.videoCodec && (
                    <MetaSection title="Video">
                      <MetaRow label="Codec" value={meta.videoCodec} />
                      {meta.width && meta.height && (
                        <MetaRow label="Resolution" value={`${meta.width} × ${meta.height}`} />
                      )}
                      {meta.frameRate && (
                        <MetaRow label="Frame Rate" value={`${meta.frameRate.toFixed(2)} fps`} />
                      )}
                    </MetaSection>
                  )}

                  {/* Audio */}
                  {meta.audioCodec && (
                    <MetaSection title="Audio">
                      <MetaRow label="Codec" value={meta.audioCodec} />
                      {meta.audioChannels && (
                        <MetaRow
                          label="Channels"
                          value={
                            meta.audioChannels === 1
                              ? "Mono"
                              : meta.audioChannels === 2
                                ? "Stereo"
                                : `${meta.audioChannels} channels`
                          }
                        />
                      )}
                      {meta.audioSampleRate && (
                        <MetaRow
                          label="Sample Rate"
                          value={`${(meta.audioSampleRate / 1000).toFixed(1)} kHz`}
                        />
                      )}
                    </MetaSection>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ── Convert Tab ──────────────────── */}
            <TabsContent value="convert" className="mt-4 space-y-4">
              <SettingRow label="Output Format">
                <Select
                  value={convertSettings.outputFormat}
                  onValueChange={(v) =>
                    v && setConvertSettings((s) => ({ ...s, outputFormat: v as OutputFormat }))
                  }
                >
                  <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Video Codec">
                <Select
                  value={convertSettings.videoCodec}
                  onValueChange={(v) =>
                    v && setConvertSettings((s) => ({ ...s, videoCodec: v as VideoCodec }))
                  }
                >
                  <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getCompatibleVideoCodecs(convertSettings.outputFormat).map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Audio Codec">
                <Select
                  value={convertSettings.audioCodec}
                  onValueChange={(v) =>
                    v && setConvertSettings((s) => ({ ...s, audioCodec: v as AudioCodec }))
                  }
                >
                  <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getCompatibleAudioCodecs(convertSettings.outputFormat).map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Resolution">
                <Select
                  value={convertSettings.resolution}
                  onValueChange={(v) =>
                    v && setConvertSettings((s) => ({ ...s, resolution: v }))
                  }
                >
                  <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Video Bitrate">
                <Select
                  value={convertSettings.videoBitrate}
                  onValueChange={(v) =>
                    v && setConvertSettings((s) => ({ ...s, videoBitrate: v }))
                  }
                >
                  <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VIDEO_BITRATE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Audio Bitrate">
                <Select
                  value={convertSettings.audioBitrate}
                  onValueChange={(v) =>
                    v && setConvertSettings((s) => ({ ...s, audioBitrate: v }))
                  }
                >
                  <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AUDIO_BITRATE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <ActionArea
                processing={processing}
                progress={progress}
                error={processError}
                resultBlob={resultBlob}
                resultName={resultName}
                originalSize={file.size}
                onRun={() => runConversion("convert")}
                onDownload={handleDownload}
                actionLabel="Convert"
              />
            </TabsContent>

            {/* ── Compress Tab ─────────────────── */}
            <TabsContent value="compress" className="mt-4 space-y-4">
              <SettingRow label="Quality">
                <Select
                  value={compressSettings.quality}
                  onValueChange={(v) =>
                    v &&
                    setCompressSettings((s) => {
                      const q = v as QualityPreset;
                      if (q !== "custom") {
                        const presets = qualityToBitrates(q);
                        return {
                          ...s,
                          quality: q,
                          videoBitrate: String(presets.video),
                          audioBitrate: String(presets.audio),
                        };
                      }
                      return { ...s, quality: q };
                    })
                  }
                >
                  <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(QUALITY_PRESETS) as QualityPreset[]).map((q) => (
                      <SelectItem key={q} value={q}>
                        {QUALITY_PRESETS[q].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <div className="text-xs text-muted-foreground pl-1">
                {QUALITY_PRESETS[compressSettings.quality].description}
              </div>

              <SettingRow label="Max Width">
                <Select
                  value={compressSettings.maxWidth}
                  onValueChange={(v) =>
                    v && setCompressSettings((s) => ({ ...s, maxWidth: v }))
                  }
                >
                  <SelectTrigger size="sm" className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Frame Rate">
                <Select
                  value={compressSettings.frameRate}
                  onValueChange={(v) =>
                    v && setCompressSettings((s) => ({ ...s, frameRate: v }))
                  }
                >
                  <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FRAME_RATE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              {compressSettings.quality === "custom" && (
                <>
                  <SettingRow label="Video Bitrate">
                    <Select
                      value={compressSettings.videoBitrate}
                      onValueChange={(v) =>
                        v && setCompressSettings((s) => ({ ...s, videoBitrate: v }))
                      }
                    >
                      <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VIDEO_BITRATE_OPTIONS.filter((o) => o.value !== "auto").map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SettingRow>

                  <SettingRow label="Audio Bitrate">
                    <Select
                      value={compressSettings.audioBitrate}
                      onValueChange={(v) =>
                        v && setCompressSettings((s) => ({ ...s, audioBitrate: v }))
                      }
                    >
                      <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AUDIO_BITRATE_OPTIONS.filter((o) => o.value !== "auto").map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SettingRow>
                </>
              )}

              <ActionArea
                processing={processing}
                progress={progress}
                error={processError}
                resultBlob={resultBlob}
                resultName={resultName}
                originalSize={file.size}
                onRun={() => runConversion("compress")}
                onDownload={handleDownload}
                actionLabel="Compress"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────

function MetaSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border">
      <div className="px-4 py-2 border-b bg-muted/40">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center px-4 py-2 text-sm">
      <span className="text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}

function ActionArea({
  processing,
  progress,
  error,
  resultBlob,
  resultName,
  originalSize,
  onRun,
  onDownload,
  actionLabel,
}: {
  processing: boolean;
  progress: number;
  error: string | null;
  resultBlob: Blob | null;
  resultName: string;
  originalSize: number;
  onRun: () => void;
  onDownload: () => void;
  actionLabel: string;
}) {
  return (
    <div className="space-y-3 pt-2">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {processing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing... {Math.round(progress * 100)}%
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {resultBlob && !processing && (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <Check className="h-4 w-4" />
            <span className="font-medium">Done</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{resultName}</span>
            <span>{formatFileSize(resultBlob.size)}</span>
            {resultBlob.size < originalSize && (
              <span className="text-green-600 dark:text-green-400">
                {Math.round((1 - resultBlob.size / originalSize) * 100)}% smaller
              </span>
            )}
            {resultBlob.size >= originalSize && (
              <span className="text-amber-600 dark:text-amber-400">
                {Math.round((resultBlob.size / originalSize - 1) * 100)}% larger
              </span>
            )}
          </div>
          <Button size="sm" className="gap-1.5" onClick={onDownload}>
            <Download className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      )}

      {!processing && !resultBlob && (
        <Button className="w-full gap-2" onClick={onRun}>
          {actionLabel === "Convert" ? (
            <ArrowRightLeft className="h-4 w-4" />
          ) : (
            <Shrink className="h-4 w-4" />
          )}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

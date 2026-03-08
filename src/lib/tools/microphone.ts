export interface MicDevice {
  deviceId: string;
  label: string;
}

export interface MicInfo {
  label: string;
  sampleRate: number;
  channelCount: number;
  latency: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export async function listAudioDevices(): Promise<MicDevice[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "audioinput")
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `Microphone ${i + 1}`,
    }));
}

export function getAudioInfo(
  stream: MediaStream,
  label: string
): MicInfo | null {
  const track = stream.getAudioTracks()[0];
  if (!track) return null;
  const s = track.getSettings() as MediaTrackSettings & { latency?: number };
  return {
    label,
    sampleRate: s.sampleRate ?? 0,
    channelCount: s.channelCount ?? 0,
    latency: s.latency ?? 0,
    echoCancellation: s.echoCancellation ?? false,
    noiseSuppression: s.noiseSuppression ?? false,
    autoGainControl: s.autoGainControl ?? false,
  };
}

export function createAnalyser(
  stream: MediaStream
): { analyser: AnalyserNode; ctx: AudioContext } {
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);
  return { analyser, ctx };
}

export function getLevel(analyser: AnalyserNode): {
  rms: number;
  peak: number;
  dbFS: number;
} {
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    sum += data[i] * data[i];
    if (abs > peak) peak = abs;
  }
  const rms = Math.sqrt(sum / data.length);
  const dbFS = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  return { rms: Math.min(1, rms * 3), peak: Math.min(1, peak), dbFS };
}

export function getFrequencyData(analyser: AnalyserNode): Uint8Array {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return data;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

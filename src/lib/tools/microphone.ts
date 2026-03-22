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

// === Noise floor ===

export type NoiseLevel = "silent" | "quiet" | "moderate" | "noisy" | "loud";

export function getNoiseLabel(dbFS: number): {
  label: string;
  level: NoiseLevel;
} {
  if (dbFS <= -55) return { label: "Silent", level: "silent" };
  if (dbFS <= -40) return { label: "Quiet room", level: "quiet" };
  if (dbFS <= -28) return { label: "Moderate noise", level: "moderate" };
  if (dbFS <= -18) return { label: "Noisy", level: "noisy" };
  return { label: "Very noisy", level: "loud" };
}

// === Diagnostic verdict ===

export type DiagStatus = "good" | "warning" | "error";

export interface DiagItem {
  label: string;
  ok: boolean;
}

export interface DiagResult {
  status: DiagStatus;
  message: string;
  items: DiagItem[];
}

export function diagnose(opts: {
  hasSignal: boolean;
  noiseFloorDb: number;
  clipCount: number;
  echoResult?: { detected: boolean } | null;
}): DiagResult {
  const items: DiagItem[] = [];

  items.push({
    label: opts.hasSignal
      ? "Signal detected"
      : "No signal — try speaking into your mic",
    ok: opts.hasSignal,
  });

  const noiseOk = opts.noiseFloorDb <= -28;
  const noise = getNoiseLabel(opts.noiseFloorDb);
  items.push({
    label: noiseOk
      ? `Low background noise (${noise.label})`
      : `High background noise (${noise.label}) — try a quieter space`,
    ok: noiseOk,
  });

  items.push({
    label:
      opts.clipCount === 0
        ? "No clipping detected"
        : `Clipping detected (${opts.clipCount}\u00d7) — lower your mic gain`,
    ok: opts.clipCount === 0,
  });

  if (opts.echoResult) {
    items.push({
      label: opts.echoResult.detected
        ? "Echo detected — try using headphones"
        : "No echo detected",
      ok: !opts.echoResult.detected,
    });
  }

  const hasSignalError = !opts.hasSignal;
  const warningCount = items.filter((i) => !i.ok).length;

  return {
    status: hasSignalError ? "error" : warningCount > 0 ? "warning" : "good",
    message: hasSignalError
      ? "No microphone signal detected"
      : warningCount > 0
        ? "Working with issues"
        : "Your microphone is working great",
    items,
  };
}

// === Echo / feedback detection ===

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * Plays a 3 kHz test tone through speakers, then checks if the mic picks it up.
 * If detected, speakers are feeding back into the microphone.
 */
export async function testEcho(
  audioCtx: AudioContext,
  analyser: AnalyserNode
): Promise<{ detected: boolean; strength: number }> {
  const testFreq = 3000;
  const binSize = audioCtx.sampleRate / analyser.fftSize;
  const targetBin = Math.round(testFreq / binSize);
  const spread = 3;

  const sampleTarget = () => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let max = 0;
    for (let b = targetBin - spread; b <= targetBin + spread; b++) {
      if (b >= 0 && b < data.length && data[b] > max) max = data[b];
    }
    return max;
  };

  // Baseline: sample before playing tone
  const baselines: number[] = [];
  for (let i = 0; i < 5; i++) {
    baselines.push(sampleTarget());
    await sleep(60);
  }
  const baseline = Math.max(...baselines);

  // Play test tone through speakers
  const osc = audioCtx.createOscillator();
  osc.frequency.value = testFreq;
  osc.type = "sine";
  const gain = audioCtx.createGain();
  gain.gain.value = 0.15;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();

  // Wait for sound to travel speaker → air → mic
  await sleep(400);

  // Sample while tone is playing
  const samples: number[] = [];
  for (let i = 0; i < 8; i++) {
    samples.push(sampleTarget());
    await sleep(50);
  }
  const duringTone = Math.max(...samples);

  osc.stop();
  gain.disconnect();
  osc.disconnect();

  const increase = duringTone - baseline;
  return {
    detected: increase > 25 && duringTone > 60,
    strength: Math.min(1, Math.max(0, increase / 80)),
  };
}

// === Waveform extraction ===

/**
 * Decodes a recorded audio blob and extracts amplitude peaks
 * for waveform visualization.
 */
export async function extractWaveform(
  blob: Blob,
  points: number = 80
): Promise<number[]> {
  try {
    const buffer = await blob.arrayBuffer();
    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(buffer);
    const data = audio.getChannelData(0);
    await ctx.close();

    const step = Math.floor(data.length / points);
    const waveform: number[] = [];
    for (let i = 0; i < points; i++) {
      let max = 0;
      const offset = i * step;
      for (let j = 0; j < step && offset + j < data.length; j++) {
        const v = Math.abs(data[offset + j]);
        if (v > max) max = v;
      }
      waveform.push(max);
    }
    return waveform;
  } catch {
    return [];
  }
}

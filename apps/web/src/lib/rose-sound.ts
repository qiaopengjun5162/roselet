import type { Rose } from "@/lib/api";
import { roseToSoundParamsWasm } from "@/lib/recommend";

export interface RoseSoundParams {
  fx: number;
  fy: number;
  waveform: OscillatorType;
  baseFreq: number;
  phase: number;
  stroke: string;
  glow: string;
}

// Rust WASM 返回 snake_case，映射到 camelCase
function mapWasm(raw: Record<string, unknown>): RoseSoundParams {
  return {
    fx:       raw.fx as number,
    fy:       raw.fy as number,
    waveform: raw.waveform as OscillatorType,
    baseFreq: raw.base_freq as number,
    phase:    raw.phase as number,
    stroke:   raw.stroke as string,
    glow:     raw.glow as string,
  };
}

export async function roseToSoundParams(rose: Rose): Promise<RoseSoundParams> {
  const raw = await roseToSoundParamsWasm(JSON.stringify({
    color:      rose.color,
    gratitude:  rose.gratitude  ?? null,
    anxiety:    rose.anxiety    ?? null,
    hope:       rose.hope       ?? null,
    like_count: rose.like_count ?? 0,
  }));
  if (!raw) throw new Error("WASM unavailable");
  return mapWasm(raw);
}

// Web Audio API 扬声器 — 只负责发声，不含任何业务算法
export function playWithParams(
  params: RoseSoundParams,
  volume = 0.25,
  durationMs?: number,
): { stop: () => void } {
  const ctx = new AudioContext();
  const merger = ctx.createChannelMerger(2);

  const leftOsc = ctx.createOscillator();
  leftOsc.type = params.waveform;
  leftOsc.frequency.value = params.baseFreq * params.fx;
  const lg = ctx.createGain(); lg.gain.value = volume;
  leftOsc.connect(lg); lg.connect(merger, 0, 0);

  const rightOsc = ctx.createOscillator();
  rightOsc.type = params.waveform;
  rightOsc.frequency.value = params.baseFreq * params.fy;
  const delay = ctx.createDelay(1);
  const rf = params.baseFreq * params.fy;
  delay.delayTime.value = rf > 0 ? params.phase / (2 * Math.PI * rf) : 0;
  const rg = ctx.createGain(); rg.gain.value = volume;
  rightOsc.connect(delay); delay.connect(rg); rg.connect(merger, 0, 1);

  merger.connect(ctx.destination);
  leftOsc.start();
  rightOsc.start();

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    leftOsc.stop();
    rightOsc.stop();
    ctx.close();
  };
  if (durationMs) setTimeout(stop, durationMs);
  return { stop };
}

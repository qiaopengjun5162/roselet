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

// TS fallback — 仅当 WASM 不可用时使用
const COLOR_FREQ: Record<string, { freq: number; stroke: string; glow: string }> = {
  red:    { freq: 220, stroke: "#f472b6", glow: "rgba(244,114,182,0.5)" },
  white:  { freq: 264, stroke: "#e2e8f0", glow: "rgba(226,232,240,0.4)" },
  yellow: { freq: 198, stroke: "#fbbf24", glow: "rgba(251,191,36,0.5)"  },
};

function roseToSoundParamsFallback(rose: Rose): RoseSoundParams {
  const c = COLOR_FREQ[rose.color] ?? COLOR_FREQ.red;
  const g = !!rose.gratitude, a = !!rose.anxiety, h = !!rose.hope;
  const ratios: Record<string, [number, number]> = {
    "111": [3,4], "101": [1,2], "110": [2,3], "011": [3,5],
    "100": [1,1], "001": [1,3], "010": [4,5], "000": [1,2],
  };
  const [fx, fy] = ratios[`${+g}${+a}${+h}`] ?? [1, 2];
  const total = (rose.gratitude?.length ?? 0) + (rose.anxiety?.length ?? 0) + (rose.hope?.length ?? 0);
  const phase = Math.min(total / 200, 1) * Math.PI;
  const likes = rose.like_count ?? 0;
  const waveform: OscillatorType = likes >= 10 ? "sine" : likes >= 3 ? "triangle" : "sawtooth";
  return { fx, fy, waveform, baseFreq: c.freq, phase, stroke: c.stroke, glow: c.glow };
}

function mapWasmResult(raw: Record<string, unknown>): RoseSoundParams {
  return {
    fx: raw.fx as number,
    fy: raw.fy as number,
    waveform: (raw.waveform as string) as OscillatorType,
    baseFreq: raw.base_freq as number,
    phase: raw.phase as number,
    stroke: raw.stroke as string,
    glow: raw.glow as string,
  };
}

// 异步版：优先 WASM，失败自动降级
export async function roseToSoundParamsAsync(rose: Rose): Promise<RoseSoundParams> {
  try {
    const raw = await roseToSoundParamsWasm(JSON.stringify({
      color: rose.color,
      gratitude: rose.gratitude ?? null,
      anxiety: rose.anxiety ?? null,
      hope: rose.hope ?? null,
      like_count: rose.like_count ?? 0,
    }));
    if (raw) return mapWasmResult(raw);
  } catch { /* fall through */ }
  return roseToSoundParamsFallback(rose);
}

// 同步版：纯 TS fallback（供测试和不需要 WASM 的场景）
export function roseToSoundParams(rose: Rose): RoseSoundParams {
  return roseToSoundParamsFallback(rose);
}

// 用 Web Audio API 播放一朵玫瑰，返回 stop 函数
export function playRose(
  rose: Rose,
  volume = 0.25,
  durationMs?: number,
): { stop: () => void; params: RoseSoundParams } {
  const params = roseToSoundParamsFallback(rose);
  const ctx = new AudioContext();
  const merger = ctx.createChannelMerger(2);

  const leftOsc = ctx.createOscillator();
  leftOsc.type = params.waveform;
  leftOsc.frequency.value = params.baseFreq * params.fx;
  const lg = ctx.createGain();
  lg.gain.value = volume;
  leftOsc.connect(lg);
  lg.connect(merger, 0, 0);

  const rightOsc = ctx.createOscillator();
  rightOsc.type = params.waveform;
  rightOsc.frequency.value = params.baseFreq * params.fy;
  const delay = ctx.createDelay(1);
  const rightFreq = params.baseFreq * params.fy;
  delay.delayTime.value = rightFreq > 0 ? params.phase / (2 * Math.PI * rightFreq) : 0;
  const rg = ctx.createGain();
  rg.gain.value = volume;
  rightOsc.connect(delay);
  delay.connect(rg);
  rg.connect(merger, 0, 1);

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

  return { stop, params };
}

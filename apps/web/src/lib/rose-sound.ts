import type { Rose } from "@/lib/api";

export interface RoseSoundParams {
  fx: number;
  fy: number;
  waveform: OscillatorType;
  baseFreq: number;
  phase: number;
  stroke: string;
  glow: string;
}

// 颜色 → 基础频率 + 光束色
const COLOR_FREQ: Record<string, { freq: number; stroke: string; glow: string }> = {
  red:    { freq: 220, stroke: "#f472b6", glow: "rgba(244,114,182,0.5)" },
  white:  { freq: 264, stroke: "#e2e8f0", glow: "rgba(226,232,240,0.4)" },
  yellow: { freq: 198, stroke: "#fbbf24", glow: "rgba(251,191,36,0.5)"  },
};

// 情绪字段组合 → 频率比
// 填写字段的模式决定图形形状
function pickRatio(rose: Rose): { fx: number; fy: number } {
  const g = !!rose.gratitude;
  const a = !!rose.anxiety;
  const h = !!rose.hope;

  if (g && a && h)  return { fx: 3, fy: 4 }; // 三者俱全：破晓旋律
  if (g && h)       return { fx: 1, fy: 2 }; // 感恩+期待：感恩之心
  if (g && a)       return { fx: 2, fy: 3 }; // 感恩+焦虑：焦虑与静
  if (a && h)       return { fx: 3, fy: 5 }; // 焦虑+期待：心跳声
  if (g)            return { fx: 1, fy: 1 }; // 只有感恩：同频共振
  if (h)            return { fx: 1, fy: 3 }; // 只有期待：期待的芽
  if (a)            return { fx: 4, fy: 5 }; // 只有焦虑：星际漫游
  return            { fx: 1, fy: 2 };
}

// 文字长度 → 相位差（内容越丰富图形越扭曲）
function pickPhase(rose: Rose): number {
  const total = (rose.gratitude?.length ?? 0)
              + (rose.anxiety?.length ?? 0)
              + (rose.hope?.length ?? 0);
  // 0~200字 → 0~π，200字以上趋近π
  return Math.min(total / 200, 1) * Math.PI;
}

// 点赞数 → 波形（赞多更纯粹，赞少更粗粝）
function pickWaveform(rose: Rose): OscillatorType {
  const likes = rose.like_count ?? 0;
  if (likes >= 10) return "sine";
  if (likes >= 3)  return "triangle";
  if (likes >= 1)  return "sawtooth";
  return "sawtooth";
}

export function roseToSoundParams(rose: Rose): RoseSoundParams {
  const c = COLOR_FREQ[rose.color] ?? COLOR_FREQ.red;
  const { fx, fy } = pickRatio(rose);
  return {
    fx,
    fy,
    waveform: pickWaveform(rose),
    baseFreq: c.freq,
    phase: pickPhase(rose),
    stroke: c.stroke,
    glow: c.glow,
  };
}

// 用 Web Audio API 播放一朵玫瑰，返回 stop 函数
export function playRose(
  rose: Rose,
  volume = 0.25,
  durationMs?: number,
): { stop: () => void; params: RoseSoundParams } {
  const params = roseToSoundParams(rose);
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

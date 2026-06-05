import { analyzeTextWasm } from "@/lib/recommend";

export interface SoundParams {
  fx: number;
  fy: number;
  waveform: OscillatorType;
  baseFreq: number;
  phase: number;
  stroke: string;
  glow: string;
  emotionLabel: string;
  intensity: number;
}

const NEUTRAL: SoundParams = {
  fx: 1, fy: 1, waveform: "sine", baseFreq: 220, phase: 0,
  stroke: "#94a3b8", glow: "rgba(148,163,184,0.4)",
  emotionLabel: "○ 中性", intensity: 0,
};

export async function analyzeTextAsync(text: string): Promise<SoundParams> {
  if (!text.trim()) return NEUTRAL;
  const raw = await analyzeTextWasm(text);
  if (!raw) return NEUTRAL;
  return {
    fx:           (raw.fx           as number)         ?? 1,
    fy:           (raw.fy           as number)         ?? 1,
    waveform:     (raw.waveform     as OscillatorType)  ?? "sine",
    baseFreq:     (raw.base_freq    as number)         ?? 220,
    phase:        (raw.phase        as number)         ?? 0,
    stroke:       (raw.stroke       as string)         ?? "#94a3b8",
    glow:         (raw.glow         as string)         ?? "rgba(148,163,184,0.4)",
    emotionLabel: (raw.emotion_label as string)        ?? "○ 中性",
    intensity:    (raw.intensity    as number)         ?? 0,
  };
}

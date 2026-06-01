// 文字 → 音乐参数的分析器接口
// 本地关键词版是默认实现，未来 AI 版只需实现同一接口替换即可

export interface SoundParams {
  fx: number;
  fy: number;
  waveform: OscillatorType;
  baseFreq: number;
  phase: number;
  stroke: string;
  glow: string;
  emotionLabel: string;
  intensity: number; // 0~1，情绪强度
}

export interface TextAnalyzer {
  analyze(text: string): SoundParams;
}

// ── 本地关键词分析器 ──────────────────────────────────────────────────
// 每类情绪关键词 + 权重，权重越高命中分越高
const EMOTION_KEYWORDS: Record<string, { words: string[]; weight: number }[]> = {
  gratitude: [
    { words: ["感谢", "感恩", "谢谢", "幸福", "开心", "快乐", "高兴", "美好", "温暖", "爱", "喜欢", "棒", "太好了", "感动"], weight: 1 },
    { words: ["还好", "不错", "可以"], weight: 0.4 },
  ],
  anxiety: [
    { words: ["焦虑", "烦", "压力", "担心", "紧张", "害怕", "恐惧", "崩溃", "难受", "痛苦", "纠结", "迷茫", "失眠", "累", "难", "不知道"], weight: 1 },
    { words: ["有点", "略微", "稍微"], weight: 0.3 },
  ],
  hope: [
    { words: ["期待", "希望", "想", "计划", "目标", "梦想", "未来", "加油", "努力", "可能", "也许", "试试", "新", "开始"], weight: 1 },
    { words: ["应该", "大概", "感觉"], weight: 0.3 },
  ],
};

const EMOTION_PARAMS: Record<string, Omit<SoundParams, "intensity" | "emotionLabel">> = {
  gratitude: { fx: 1, fy: 2, waveform: "sine",     baseFreq: 220, phase: 0.3, stroke: "#f472b6", glow: "rgba(244,114,182,0.5)" },
  anxiety:   { fx: 2, fy: 3, waveform: "sawtooth", baseFreq: 180, phase: 1.2, stroke: "#38bdf8", glow: "rgba(56,189,248,0.5)"  },
  hope:      { fx: 1, fy: 3, waveform: "triangle", baseFreq: 264, phase: 0.6, stroke: "#a78bfa", glow: "rgba(167,139,250,0.5)" },
  neutral:   { fx: 1, fy: 1, waveform: "sine",     baseFreq: 220, phase: 0,   stroke: "#94a3b8", glow: "rgba(148,163,184,0.4)" },
};

const EMOTION_LABELS: Record<string, string> = {
  gratitude: "🌹 感恩",
  anxiety:   "🌵 焦虑",
  hope:      "🌱 期待",
  neutral:   "○ 中性",
};

function scoreText(text: string): Record<string, number> {
  const scores: Record<string, number> = { gratitude: 0, anxiety: 0, hope: 0 };
  for (const [emotion, groups] of Object.entries(EMOTION_KEYWORDS)) {
    for (const { words, weight } of groups) {
      for (const word of words) {
        if (text.includes(word)) scores[emotion] += weight;
      }
    }
  }
  return scores;
}

// 文字长度 → 相位微调（字越多图形越丰富）
function lengthToPhase(text: string, base: number): number {
  const extra = Math.min(text.length / 100, 1) * 0.8;
  return base + extra;
}

export class LocalKeywordAnalyzer implements TextAnalyzer {
  analyze(text: string): SoundParams {
    if (!text.trim()) return { ...EMOTION_PARAMS.neutral, emotionLabel: EMOTION_LABELS.neutral, intensity: 0 };

    const scores = scoreText(text);
    const topEmotion = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const emotion = topEmotion[1] > 0 ? topEmotion[0] : "neutral";
    const maxPossible = 5; // 约5个词全命中
    const intensity = Math.min((topEmotion[1] ?? 0) / maxPossible, 1);

    const base = EMOTION_PARAMS[emotion];
    // 强度影响频率比：情绪越强烈，频率比越复杂
    const fy = intensity > 0.6 ? base.fy + 1 : base.fy;

    return {
      ...base,
      fy,
      phase: lengthToPhase(text, base.phase),
      // 强度影响音量（由调用方使用）
      intensity,
      emotionLabel: EMOTION_LABELS[emotion],
    };
  }
}

// 单例，调用方统一用这个
// 未来换成 AIAnalyzer 只需改这一行
export const defaultAnalyzer: TextAnalyzer = new LocalKeywordAnalyzer();

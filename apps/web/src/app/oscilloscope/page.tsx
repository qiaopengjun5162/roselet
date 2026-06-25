"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { analyzeTextAsync, type SoundParams } from "@/lib/text-to-sound";
import { prepareForegroundAudio } from "@/lib/sound";

const PRESETS = [
  { label: "同频共振", fx: 1, fy: 1, emotion: "gratitude", desc: "心与心的共鸣，感恩最纯粹的形状" },
  { label: "感恩之心", fx: 1, fy: 2, emotion: "gratitude", desc: "玫瑰的律动，双重的幸福" },
  { label: "期待的芽", fx: 1, fy: 3, emotion: "hope",      desc: "花苞未开，却已孕育无限可能" },
  { label: "焦虑与静", fx: 2, fy: 3, emotion: "anxiety",   desc: "尖刺与柔软的交织，寻找平衡" },
  { label: "破晓旋律", fx: 3, fy: 4, emotion: "hope",      desc: "黎明前最美的期待" },
  { label: "心跳声",   fx: 3, fy: 5, emotion: "gratitude", desc: "每一次呼吸都是感谢" },
  { label: "星际漫游", fx: 4, fy: 5, emotion: "hope",      desc: "在宇宙中寻找那朵玫瑰" },
  { label: "尖刺之美", fx: 5, fy: 6, emotion: "anxiety",   desc: "直面焦虑，它也有其形状" },
] as const;
type Preset = typeof PRESETS[number];

const WAVEFORMS = ["sine", "sawtooth", "triangle", "square"] as const;
type Waveform = typeof WAVEFORMS[number];

const EMOTION_COLORS = {
  gratitude: { stroke: "#f472b6", glow: "rgba(244,114,182,0.45)", name: "玫瑰粉" },
  hope:      { stroke: "#a78bfa", glow: "rgba(167,139,250,0.45)", name: "花苞紫" },
  anxiety:   { stroke: "#38bdf8", glow: "rgba(56,189,248,0.45)",  name: "幽蓝" },
};
const EXTRA_COLOR = { stroke: "#34d399", glow: "rgba(52,211,153,0.4)", name: "翠绿" };

type ColorKey = keyof typeof EMOTION_COLORS | "extra";

// 从 SoundParams 提取显示用颜色
function colorFromParams(p: SoundParams) {
  return { stroke: p.stroke, glow: p.glow };
}

export default function OscilloscopePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  // 模式：preset（固定预设）/ text（文字驱动）
  const [mode, setMode] = useState<"preset" | "text">("preset");
  const [inputText, setInputText] = useState("");
  const [textParams, setTextParams] = useState<SoundParams | null>(null);

  const [playing, setPlaying] = useState(false);
  const [preset, setPreset] = useState<Preset>(PRESETS[1]);
  const [waveform, setWaveform] = useState<Waveform>("sine");
  const [phase, setPhase] = useState(0);
  const [baseFreq, setBaseFreq] = useState(220);
  const [volume, setVolume] = useState(0.3);
  const [manualColor, setManualColor] = useState<ColorKey | null>(null);

  const activeParams = useMemo(() => (
    mode === "text" && textParams
      ? {
          fx: textParams.fx,
          fy: textParams.fy,
          waveform: textParams.waveform as Waveform,
          baseFreq: textParams.baseFreq,
          phase: textParams.phase,
        }
      : { fx: preset.fx, fy: preset.fy, waveform, baseFreq, phase }
  ), [baseFreq, mode, phase, preset, textParams, waveform]);

  // 当前光束颜色
  const autoColor = mode === "text" && textParams
    ? colorFromParams(textParams)
    : EMOTION_COLORS[preset.emotion as keyof typeof EMOTION_COLORS];
  const color = manualColor === "extra"
    ? EXTRA_COLOR
    : (manualColor !== null && manualColor in EMOTION_COLORS)
      ? EMOTION_COLORS[manualColor as keyof typeof EMOTION_COLORS]
      : autoColor;

  // 文字分析（实时，debounce 300ms）
  useEffect(() => {
    if (mode !== "text") return;
    const id = setTimeout(() => {
      analyzeTextAsync(inputText).then(setTextParams);
    }, 300);
    return () => clearTimeout(id);
  }, [inputText, mode]);

  const start = useCallback(async () => {
    const p = activeParams;
    await prepareForegroundAudio();
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const merger = ctx.createChannelMerger(2);

    const aL = ctx.createAnalyser(); aL.fftSize = 512; analyserLRef.current = aL;
    const aR = ctx.createAnalyser(); aR.fftSize = 512; analyserRRef.current = aR;

    const leftOsc = ctx.createOscillator();
    leftOsc.type = p.waveform;
    leftOsc.frequency.value = p.baseFreq * p.fx;
    const lg = ctx.createGain(); lg.gain.value = volume;
    leftOsc.connect(lg); lg.connect(aL); lg.connect(merger, 0, 0);

    const rightOsc = ctx.createOscillator();
    rightOsc.type = p.waveform;
    rightOsc.frequency.value = p.baseFreq * p.fy;
    const delay = ctx.createDelay(1);
    const rf = p.baseFreq * p.fy;
    delay.delayTime.value = rf > 0 ? p.phase / (2 * Math.PI * rf) : 0;
    const rg = ctx.createGain(); rg.gain.value = volume;
    rightOsc.connect(delay); delay.connect(rg); rg.connect(aR); rg.connect(merger, 0, 1);

    merger.connect(ctx.destination);
    leftOsc.start(); rightOsc.start();
    setPlaying(true);
  }, [activeParams, volume]);

  const stop = useCallback(() => {
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    cancelAnimationFrame(animRef.current);
    trailRef.current = [];
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const canvas = canvasRef.current;
    if (!canvas || !analyserLRef.current || !analyserRRef.current) return;
    const ctx2d = canvas.getContext("2d")!;
    const W = canvas.width; const H = canvas.height;
    const bufLen = analyserLRef.current.frequencyBinCount;
    const bufL = new Float32Array(bufLen); const bufR = new Float32Array(bufLen);
    const TRAIL = 2400;

    function draw() {
      animRef.current = requestAnimationFrame(draw);
      if (!analyserLRef.current || !analyserRRef.current) return;
      analyserLRef.current.getFloatTimeDomainData(bufL);
      analyserRRef.current.getFloatTimeDomainData(bufR);
      for (let i = 0; i < bufLen; i++) {
        trailRef.current.push({ x: (bufL[i] * 0.44 + 0.5) * W, y: (bufR[i] * -0.44 + 0.5) * H });
      }
      if (trailRef.current.length > TRAIL) trailRef.current = trailRef.current.slice(-TRAIL);
      ctx2d.fillStyle = "rgba(8,14,12,0.3)";
      ctx2d.fillRect(0, 0, W, H);
      const pts = trailRef.current;
      if (pts.length < 2) return;
      ctx2d.lineWidth = 1.6; ctx2d.shadowBlur = 10; ctx2d.shadowColor = color.glow; ctx2d.lineCap = "round";
      for (let i = 1; i < pts.length; i++) {
        const alpha = Math.floor((i / pts.length) * 220).toString(16).padStart(2, "0");
        ctx2d.strokeStyle = color.stroke + alpha;
        ctx2d.beginPath(); ctx2d.moveTo(pts[i-1].x, pts[i-1].y); ctx2d.lineTo(pts[i].x, pts[i].y); ctx2d.stroke();
      }
    }
    ctx2d.fillStyle = "#080e0c"; ctx2d.fillRect(0, 0, W, H);
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, color]);

  const emotionTag: Record<string, { label: string; cls: string }> = {
    gratitude: { label: "🌹 感恩", cls: "text-yellow-400 border-yellow-400/40" },
    hope:      { label: "🌱 期待", cls: "text-fuchsia-400 border-fuchsia-400/40" },
    anxiety:   { label: "🌵 焦虑", cls: "text-sky-400 border-sky-400/40" },
    neutral:   { label: "○ 中性", cls: "text-slate-400 border-slate-400/40" },
  };

  const currentEmotion = mode === "text" && textParams ? textParams.emotionLabel : emotionTag[preset.emotion]?.label;
  const currentDesc    = mode === "text" && textParams
    ? (inputText.trim() ? `检测到情绪强度 ${Math.round((textParams.intensity ?? 0) * 100)}%` : "输入你的感受，图形会随之改变")
    : preset.desc;
  const currentEmotionKey = mode === "text" && textParams
    ? (Object.entries(emotionTag).find(([, v]) => v.label === textParams.emotionLabel)?.[0] ?? "neutral")
    : preset.emotion;

  return (
    <main className="relative h-full px-4 pb-12 pt-16 z-10 overflow-hidden">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Canvas + 情绪标签 */}
        <div className="flex flex-col items-center gap-3">
          <canvas ref={canvasRef} width={460} height={360}
            className="rounded-2xl border border-white/10 bg-[#080e0c] w-full"
            style={{ boxShadow: `0 0 48px ${color.glow}`, maxWidth: 460 }} />
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${emotionTag[currentEmotionKey]?.cls ?? "text-slate-400 border-slate-400/40"}`}>
              {currentEmotion}
            </span>
            <span className="text-xs text-slate-400 italic">{currentDesc}</span>
          </div>
        </div>

        {/* 模式切换 */}
        <div className="flex rounded-full overflow-hidden border border-white/10 text-sm">
          <button onClick={() => setMode("preset")}
            className={`flex-1 py-2 transition-all ${mode === "preset" ? "bg-rose-500/70 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            预设情绪
          </button>
          <button onClick={() => setMode("text")}
            className={`flex-1 py-2 transition-all ${mode === "text" ? "bg-purple-500/70 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            ✏️ 说出你的感受
          </button>
        </div>

        {/* 文字输入模式 */}
        {mode === "text" && (
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs text-slate-400">
              输入任何感受，图形会实时变化 · 边输入边听
            </p>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="今天很开心，因为……&#10;或者：最近有点焦虑，工作压力很大……&#10;或者：很期待下周的旅行……"
              rows={4}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-rose-400"
            />
            {inputText.trim() && textParams && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>检测到：</span>
                <span className={emotionTag[currentEmotionKey]?.cls}>{currentEmotion}</span>
                <span>·</span>
                <span>强度 {Math.round((textParams.intensity ?? 0) * 100)}%</span>
                <span>·</span>
                <span>频率比 {textParams.fx}∶{textParams.fy}</span>
              </div>
            )}
          </div>
        )}

        {/* 控制面板 */}
        <div className="glass-card p-5 space-y-4">

          {/* 预设模式：情绪频率按钮 */}
          {mode === "preset" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">情绪频率（利萨如图形）</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button key={p.label} onClick={() => { setPreset(p); setManualColor(null); }}
                    className={`px-3 py-1 rounded-full text-xs transition-all ${preset.label === p.label ? "text-white" : "glass-card text-slate-300 hover:border-white/30"}`}
                    style={preset.label === p.label ? { background: EMOTION_COLORS[p.emotion as keyof typeof EMOTION_COLORS].stroke + "99", boxShadow: `0 0 8px ${EMOTION_COLORS[p.emotion as keyof typeof EMOTION_COLORS].glow}` } : {}}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 预设模式：手动波形 */}
          {mode === "preset" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">波形</p>
              <div className="flex gap-2 flex-wrap">
                {WAVEFORMS.map((w) => (
                  <button key={w} onClick={() => setWaveform(w)}
                    className={`px-3 py-1 rounded-full text-xs transition-all ${waveform === w ? "bg-purple-500/80 text-white" : "glass-card text-slate-300 hover:border-white/30"}`}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 预设模式：手动旋钮 */}
          {mode === "preset" && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-slate-400">相位差 {(phase / Math.PI).toFixed(2)}π</p>
                <input type="range" min={0} max={6.28} step={0.01} value={phase} onChange={(e) => setPhase(Number(e.target.value))} className="w-full accent-rose-400" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">基频 {baseFreq} Hz</p>
                <input type="range" min={55} max={440} step={1} value={baseFreq} onChange={(e) => setBaseFreq(Number(e.target.value))} className="w-full accent-purple-400" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-400">音量 {Math.round(volume * 100)}%</p>
                <input type="range" min={0} max={0.8} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-sky-400" />
              </div>
            </div>
          )}

          {/* 文字模式：只显示音量 */}
          {mode === "text" && (
            <div className="space-y-1 max-w-xs">
              <p className="text-xs text-slate-400">音量 {Math.round(volume * 100)}%</p>
              <input type="range" min={0} max={0.8} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-sky-400" />
            </div>
          )}

          {/* 光束颜色 */}
          <div className="flex gap-3 items-center">
            <p className="text-xs text-slate-400">光束</p>
            {Object.entries(EMOTION_COLORS).map(([key, c]) => (
              <button key={key} onClick={() => setManualColor(manualColor === key ? null : key as ColorKey)}
                title={c.name}
                className={`w-5 h-5 rounded-full border-2 transition-all ${(manualColor === null && currentEmotionKey === key) || manualColor === key ? "border-white scale-125" : "border-white/20"}`}
                style={{ background: c.stroke, boxShadow: `0 0 6px ${c.glow}` }} />
            ))}
            <button onClick={() => setManualColor(manualColor === "extra" ? null : "extra")}
              title={EXTRA_COLOR.name}
              className={`w-5 h-5 rounded-full border-2 transition-all ${manualColor === "extra" ? "border-white scale-125" : "border-white/20"}`}
              style={{ background: EXTRA_COLOR.stroke, boxShadow: `0 0 6px ${EXTRA_COLOR.glow}` }} />
          </div>

          {/* 播放按钮 */}
          <button onClick={playing ? stop : start}
            className={`w-full py-3 rounded-full font-semibold text-sm transition-all ${playing ? "glass-card text-slate-300 hover:border-white/30" : "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 hover:-translate-y-0.5"}`}>
            {playing ? "■ 停止" : "▶ 开始感受"}
          </button>

          <p className="text-xs text-slate-500 text-center">
            插耳机 → 示波器 L=CH1 R=CH2 → X-Y 模式，即可看到真实利萨如图形
          </p>
        </div>
      </div>
    </main>
  );
}

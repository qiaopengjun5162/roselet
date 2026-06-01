"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// 每个预设对应一种情绪频率，和 Roselet 的玫瑰/尖刺/花苞概念融合
const PRESETS = [
  { label: "同频共振", fx: 1, fy: 1, emotion: "gratitude", desc: "心与心的共鸣，感恩最纯粹的形状" },
  { label: "感恩之心", fx: 1, fy: 2, emotion: "gratitude", desc: "玫瑰的律动，双重的幸福" },
  { label: "期待的芽", fx: 1, fy: 3, emotion: "hope", desc: "花苞未开，却已孕育无限可能" },
  { label: "焦虑与静", fx: 2, fy: 3, emotion: "anxiety", desc: "尖刺与柔软的交织，寻找平衡" },
  { label: "破晓旋律", fx: 3, fy: 4, emotion: "hope", desc: "黎明前最美的期待" },
  { label: "心跳声", fx: 3, fy: 5, emotion: "gratitude", desc: "每一次呼吸都是感谢" },
  { label: "星际漫游", fx: 4, fy: 5, emotion: "hope", desc: "在宇宙中寻找那朵玫瑰" },
  { label: "尖刺之美", fx: 5, fy: 6, emotion: "anxiety", desc: "直面焦虑，它也有其形状" },
] as const;

type Preset = typeof PRESETS[number];

const WAVEFORMS = ["sine", "sawtooth", "triangle", "square"] as const;
type Waveform = typeof WAVEFORMS[number];

// 颜色和 Roselet 三种情绪对应
const EMOTION_COLORS = {
  gratitude: { stroke: "#f472b6", glow: "rgba(244,114,182,0.45)", name: "玫瑰粉" },
  hope:      { stroke: "#a78bfa", glow: "rgba(167,139,250,0.45)", name: "花苞紫" },
  anxiety:   { stroke: "#38bdf8", glow: "rgba(56,189,248,0.45)",  name: "幽蓝" },
};

const EXTRA_COLORS = [
  { stroke: "#34d399", glow: "rgba(52,211,153,0.4)", name: "翠绿" },
];

export default function OscilloscopePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  const [playing, setPlaying] = useState(false);
  const [preset, setPreset] = useState<Preset>(PRESETS[1]);
  const [waveform, setWaveform] = useState<Waveform>("sine");
  const [phase, setPhase] = useState(0);
  const [baseFreq, setBaseFreq] = useState(220);
  const [volume, setVolume] = useState(0.3);
  const [manualColor, setManualColor] = useState<string | null>(null);

  // 默认跟随情绪颜色，可手动切换
  const autoColor = EMOTION_COLORS[preset.emotion];
  const extraColor = EXTRA_COLORS[0];
  const color = manualColor === "extra" ? extraColor : autoColor;

  const start = useCallback(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const merger = ctx.createChannelMerger(2);

    const analyserL = ctx.createAnalyser();
    analyserL.fftSize = 512;
    analyserLRef.current = analyserL;
    const analyserR = ctx.createAnalyser();
    analyserR.fftSize = 512;
    analyserRRef.current = analyserR;

    const leftOsc = ctx.createOscillator();
    leftOsc.type = waveform;
    leftOsc.frequency.value = baseFreq * preset.fx;
    const leftGain = ctx.createGain();
    leftGain.gain.value = volume;
    leftOsc.connect(leftGain);
    leftGain.connect(analyserL);
    leftGain.connect(merger, 0, 0);

    const rightOsc = ctx.createOscillator();
    rightOsc.type = waveform;
    rightOsc.frequency.value = baseFreq * preset.fy;
    const delay = ctx.createDelay(1);
    const rightFreq = baseFreq * preset.fy;
    delay.delayTime.value = rightFreq > 0 ? phase / (2 * Math.PI * rightFreq) : 0;
    const rightGain = ctx.createGain();
    rightGain.gain.value = volume;
    rightOsc.connect(delay);
    delay.connect(rightGain);
    rightGain.connect(analyserR);
    rightGain.connect(merger, 0, 1);

    merger.connect(ctx.destination);
    leftOsc.start();
    rightOsc.start();
    setPlaying(true);
  }, [waveform, baseFreq, preset, phase, volume]);

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
    const W = canvas.width;
    const H = canvas.height;
    const bufLen = analyserLRef.current.frequencyBinCount;
    const bufL = new Float32Array(bufLen);
    const bufR = new Float32Array(bufLen);
    const TRAIL = 2400;

    function draw() {
      animRef.current = requestAnimationFrame(draw);
      if (!analyserLRef.current || !analyserRRef.current) return;
      analyserLRef.current.getFloatTimeDomainData(bufL);
      analyserRRef.current.getFloatTimeDomainData(bufR);

      for (let i = 0; i < bufLen; i++) {
        trailRef.current.push({
          x: (bufL[i] * 0.44 + 0.5) * W,
          y: (bufR[i] * -0.44 + 0.5) * H,
        });
      }
      if (trailRef.current.length > TRAIL) {
        trailRef.current = trailRef.current.slice(-TRAIL);
      }

      ctx2d.fillStyle = "rgba(8,14,12,0.3)";
      ctx2d.fillRect(0, 0, W, H);

      const pts = trailRef.current;
      if (pts.length < 2) return;
      ctx2d.lineWidth = 1.6;
      ctx2d.shadowBlur = 10;
      ctx2d.shadowColor = color.glow;
      ctx2d.lineCap = "round";

      for (let i = 1; i < pts.length; i++) {
        const alpha = Math.floor((i / pts.length) * 220).toString(16).padStart(2, "0");
        ctx2d.strokeStyle = color.stroke + alpha;
        ctx2d.beginPath();
        ctx2d.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx2d.lineTo(pts[i].x, pts[i].y);
        ctx2d.stroke();
      }
    }

    ctx2d.fillStyle = "#080e0c";
    ctx2d.fillRect(0, 0, W, H);
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, color]);

  const emotionTag = {
    gratitude: { label: "🌹 感恩", cls: "text-yellow-400 border-yellow-400/40" },
    hope:      { label: "🌱 期待", cls: "text-fuchsia-400 border-fuchsia-400/40" },
    anxiety:   { label: "🌵 焦虑", cls: "text-sky-400 border-sky-400/40" },
  };

  return (
    <main className="relative min-h-screen px-4 pb-8 pt-6 z-10">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* 标题 */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-300 to-purple-300">
            情绪示波器
          </h1>
          <p className="text-sm text-slate-400">
            每种情绪都有自己的形状 · 左右声道 XY 模式 · 所听即所见
          </p>
        </div>

        {/* Canvas + 情绪标签 */}
        <div className="flex flex-col items-center gap-3">
          <canvas
            ref={canvasRef}
            width={460}
            height={380}
            className="rounded-2xl border border-white/10 bg-[#080e0c] w-full"
            style={{ boxShadow: `0 0 48px ${color.glow}`, maxWidth: 460 }}
          />
          {/* 当前情绪 + 描述 */}
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${emotionTag[preset.emotion].cls}`}>
              {emotionTag[preset.emotion].label}
            </span>
            <span className="text-xs text-slate-400 italic">{preset.desc}</span>
          </div>
        </div>

        {/* 控制面板 */}
        <div className="glass-card p-5 space-y-4">

          {/* 情绪频率 */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400">情绪频率（利萨如图形）</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setPreset(p); setManualColor(null); }}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    preset.label === p.label
                      ? "text-white"
                      : "glass-card text-slate-300 hover:border-white/30"
                  }`}
                  style={preset.label === p.label
                    ? { background: EMOTION_COLORS[p.emotion].stroke + "99", boxShadow: `0 0 8px ${EMOTION_COLORS[p.emotion].glow}` }
                    : {}
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 波形 */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400">波形</p>
            <div className="flex gap-2 flex-wrap">
              {WAVEFORMS.map((w) => (
                <button key={w} onClick={() => setWaveform(w)}
                  className={`px-3 py-1 rounded-full text-xs transition-all ${
                    waveform === w ? "bg-purple-500/80 text-white" : "glass-card text-slate-300 hover:border-white/30"
                  }`}>{w}</button>
              ))}
            </div>
          </div>

          {/* 旋钮 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-slate-400">相位差 {(phase / Math.PI).toFixed(2)}π</p>
              <input type="range" min={0} max={6.28} step={0.01} value={phase}
                onChange={(e) => setPhase(Number(e.target.value))}
                className="w-full accent-rose-400" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-400">基频 {baseFreq} Hz</p>
              <input type="range" min={55} max={440} step={1} value={baseFreq}
                onChange={(e) => setBaseFreq(Number(e.target.value))}
                className="w-full accent-purple-400" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-400">音量 {Math.round(volume * 100)}%</p>
              <input type="range" min={0} max={0.8} step={0.01} value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-sky-400" />
            </div>
          </div>

          {/* 光束颜色（手动覆盖） */}
          <div className="flex gap-3 items-center">
            <p className="text-xs text-slate-400">光束</p>
            {Object.entries(EMOTION_COLORS).map(([key, c]) => (
              <button key={key} onClick={() => setManualColor(manualColor === key ? null : key)}
                title={c.name}
                className={`w-5 h-5 rounded-full border-2 transition-all ${
                  (manualColor === null && preset.emotion === key) || manualColor === key
                    ? "border-white scale-125" : "border-white/20"
                }`}
                style={{ background: c.stroke, boxShadow: `0 0 6px ${c.glow}` }} />
            ))}
            <button onClick={() => setManualColor(manualColor === "extra" ? null : "extra")}
              title={extraColor.name}
              className={`w-5 h-5 rounded-full border-2 transition-all ${
                manualColor === "extra" ? "border-white scale-125" : "border-white/20"
              }`}
              style={{ background: extraColor.stroke, boxShadow: `0 0 6px ${extraColor.glow}` }} />
          </div>

          {/* 播放 */}
          <button onClick={playing ? stop : start}
            className={`w-full py-3 rounded-full font-semibold text-sm transition-all ${
              playing
                ? "glass-card text-slate-300 hover:border-white/30"
                : "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 hover:-translate-y-0.5"
            }`}>
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

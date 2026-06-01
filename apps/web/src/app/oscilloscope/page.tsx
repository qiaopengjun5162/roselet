"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const PRESETS = [
  { label: "1∶1", fx: 1, fy: 1 },
  { label: "1∶2", fx: 1, fy: 2 },
  { label: "1∶3", fx: 1, fy: 3 },
  { label: "2∶3", fx: 2, fy: 3 },
  { label: "3∶4", fx: 3, fy: 4 },
  { label: "3∶5", fx: 3, fy: 5 },
  { label: "4∶5", fx: 4, fy: 5 },
  { label: "5∶6", fx: 5, fy: 6 },
] as const;

const WAVEFORMS = ["sine", "sawtooth", "triangle", "square"] as const;
type Waveform = (typeof WAVEFORMS)[number];

const COLORS = [
  { label: "玫瑰", stroke: "#f472b6", glow: "rgba(244,114,182,0.4)" },
  { label: "幽蓝", stroke: "#38bdf8", glow: "rgba(56,189,248,0.4)" },
  { label: "紫光", stroke: "#a78bfa", glow: "rgba(167,139,250,0.4)" },
  { label: "翠绿", stroke: "#34d399", glow: "rgba(52,211,153,0.4)" },
];

export default function OscilloscopePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);

  const [playing, setPlaying] = useState(false);
  const [preset, setPreset] = useState(PRESETS[1]);
  const [waveform, setWaveform] = useState<Waveform>("sine");
  const [phase, setPhase] = useState(0);
  const [baseFreq, setBaseFreq] = useState(220);
  const [colorIdx, setColorIdx] = useState(0);
  const [volume, setVolume] = useState(0.3);

  const color = COLORS[colorIdx];

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

    // 左声道
    const leftOsc = ctx.createOscillator();
    leftOsc.type = waveform;
    leftOsc.frequency.value = baseFreq * preset.fx;
    const leftGain = ctx.createGain();
    leftGain.gain.value = volume;
    leftOsc.connect(leftGain);
    leftGain.connect(analyserL);
    leftGain.connect(merger, 0, 0);

    // 右声道 + 相位延迟
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

      for (let i = 0; i < bufLen; i += 1) {
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

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center gap-5 px-4 pb-8 pt-6 z-10">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-300 to-purple-300">
          示波器花园
        </h1>
        <p className="text-sm text-slate-400">左右声道 XY 模式 · 所听即所见</p>
      </div>

      <canvas
        ref={canvasRef}
        width={460}
        height={460}
        className="rounded-2xl border border-white/10 bg-[#080e0c]"
        style={{ boxShadow: `0 0 48px ${color.glow}` }}
      />

      <div className="glass-card p-5 space-y-4 w-full max-w-lg">
        {/* 频率比 */}
        <div className="space-y-2">
          <p className="text-xs text-slate-400">频率比（利萨如图形）</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => setPreset(p)}
                className={`px-3 py-1 rounded-full text-sm transition-all ${
                  preset.label === p.label
                    ? "bg-rose-500/80 text-white"
                    : "glass-card text-slate-300 hover:border-white/30"
                }`}>{p.label}</button>
            ))}
          </div>
        </div>

        {/* 波形 */}
        <div className="space-y-2">
          <p className="text-xs text-slate-400">波形</p>
          <div className="flex gap-2 flex-wrap">
            {WAVEFORMS.map((w) => (
              <button key={w} onClick={() => setWaveform(w)}
                className={`px-3 py-1 rounded-full text-sm transition-all ${
                  waveform === w
                    ? "bg-purple-500/80 text-white"
                    : "glass-card text-slate-300 hover:border-white/30"
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

        {/* 光束颜色 */}
        <div className="flex gap-3 items-center">
          <p className="text-xs text-slate-400">光束</p>
          {COLORS.map((c, i) => (
            <button key={c.label} onClick={() => setColorIdx(i)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${
                colorIdx === i ? "border-white scale-125" : "border-white/20"
              }`}
              style={{ background: c.stroke, boxShadow: colorIdx === i ? `0 0 10px ${c.glow}` : "none" }} />
          ))}
        </div>

        {/* 播放 */}
        <button onClick={playing ? stop : start}
          className={`w-full py-3 rounded-full font-semibold text-sm transition-all ${
            playing
              ? "glass-card text-slate-300 hover:border-white/30"
              : "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 hover:-translate-y-0.5"
          }`}>
          {playing ? "■ 停止" : "▶ 开始"}
        </button>

        <p className="text-xs text-slate-500 text-center">
          插耳机 → 示波器 L=CH1 R=CH2 → X-Y 模式，即可看到真实利萨如图形
        </p>
      </div>
    </main>
  );
}

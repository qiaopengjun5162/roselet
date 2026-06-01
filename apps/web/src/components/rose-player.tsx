"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { roseToSoundParams, playRose, type RoseSoundParams } from "@/lib/rose-sound";
import type { Rose } from "@/lib/api";

interface RosePlayerProps {
  rose: Rose;
  autoPlay?: boolean;
  durationMs?: number;
  canvasSize?: number;
  onStop?: () => void;
}

export function RosePlayer({
  rose,
  autoPlay = false,
  durationMs,
  canvasSize = 200,
  onStop,
}: RosePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserLRef = useRef<AnalyserNode | null>(null);
  const analyserRRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number>(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const stopFnRef = useRef<(() => void) | null>(null);

  const [playing, setPlaying] = useState(false);
  const [params, setParams] = useState<RoseSoundParams>(() => roseToSoundParams(rose));

  const stop = useCallback(() => {
    stopFnRef.current?.();
    stopFnRef.current = null;
    cancelAnimationFrame(animRef.current);
    trailRef.current = [];
    analyserLRef.current = null;
    analyserRRef.current = null;
    setPlaying(false);
    onStop?.();
  }, [onStop]);

  const start = useCallback(() => {
    const p = roseToSoundParams(rose);
    setParams(p);

    const ctx = new AudioContext();
    const merger = ctx.createChannelMerger(2);

    const aL = ctx.createAnalyser(); aL.fftSize = 256; analyserLRef.current = aL;
    const aR = ctx.createAnalyser(); aR.fftSize = 256; analyserRRef.current = aR;

    const leftOsc = ctx.createOscillator();
    leftOsc.type = p.waveform;
    leftOsc.frequency.value = p.baseFreq * p.fx;
    const lg = ctx.createGain(); lg.gain.value = 0.25;
    leftOsc.connect(lg); lg.connect(aL); lg.connect(merger, 0, 0);

    const rightOsc = ctx.createOscillator();
    rightOsc.type = p.waveform;
    rightOsc.frequency.value = p.baseFreq * p.fy;
    const delay = ctx.createDelay(1);
    const rf = p.baseFreq * p.fy;
    delay.delayTime.value = rf > 0 ? p.phase / (2 * Math.PI * rf) : 0;
    const rg = ctx.createGain(); rg.gain.value = 0.25;
    rightOsc.connect(delay); delay.connect(rg); rg.connect(aR); rg.connect(merger, 0, 1);

    merger.connect(ctx.destination);
    leftOsc.start();
    rightOsc.start();

    let stopped = false;
    stopFnRef.current = () => {
      if (stopped) return;
      stopped = true;
      leftOsc.stop();
      rightOsc.stop();
      ctx.close();
    };

    setPlaying(true);
    if (durationMs) setTimeout(stop, durationMs);
  }, [rose, durationMs, stop]);

  // Canvas 绘制
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
    const TRAIL = 800;

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
      if (trailRef.current.length > TRAIL) trailRef.current = trailRef.current.slice(-TRAIL);

      ctx2d.fillStyle = "rgba(8,14,12,0.35)";
      ctx2d.fillRect(0, 0, W, H);

      const pts = trailRef.current;
      if (pts.length < 2) return;
      ctx2d.lineWidth = 1.4;
      ctx2d.shadowBlur = 8;
      ctx2d.shadowColor = params.glow;
      ctx2d.lineCap = "round";

      for (let i = 1; i < pts.length; i++) {
        const alpha = Math.floor((i / pts.length) * 200).toString(16).padStart(2, "0");
        ctx2d.strokeStyle = params.stroke + alpha;
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
  }, [playing, params]);

  // autoPlay
  useEffect(() => {
    if (autoPlay) start();
    return () => { stopFnRef.current?.(); cancelAnimationFrame(animRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        className="rounded-xl border border-white/10 bg-[#080e0c]"
        style={{ boxShadow: playing ? `0 0 24px ${params.glow}` : "none", transition: "box-shadow 0.5s" }}
      />
      <button
        onClick={playing ? stop : start}
        className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
          playing
            ? "glass-card text-slate-300 hover:border-white/30"
            : "bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md shadow-rose-500/30 hover:-translate-y-0.5"
        }`}
      >
        {playing ? "■ 停止" : "▶ 听这朵玫瑰"}
      </button>
    </div>
  );
}

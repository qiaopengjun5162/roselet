"use client";

import { useEffect, useState } from "react";

interface PetalConfig { emoji: string; left: number; size: number; duration: number; delay: number; sway: number; opacity: number; }

const FALLBACK: PetalConfig[] = ["🌸","🌺","🌷","💮","🏵️","🌼","✿","❀","🌹","💐","🌻","🪷"].map((e,i) => ({
  emoji: e, left: (i * 8.7 + 3) % 100, size: 16 + (i * 3.4) % 20,
  duration: 8 + (i * 1.3) % 6, delay: (i * 1.7) % 8, sway: 20 + (i * 7) % 40, opacity: 0.25,
}));

async function loadPetals(): Promise<PetalConfig[]> {
  try {
    const mod = await import("../../public/pkg/roselet_recommend.js");
    await mod.default();
    return (mod.generate_petals_wasm(12, BigInt(42)) as PetalConfig[]) || FALLBACK;
  } catch { return FALLBACK; }
}

export function FallingPetals() {
  const [petals, setPetals] = useState<PetalConfig[]>(FALLBACK);
  useEffect(() => { loadPetals().then(setPetals); }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {petals.map((p, i) => (
        <span key={i} className="absolute block" style={{
          left: `${p.left}%`, top: "-5%", fontSize: `${p.size}px`,
          opacity: p.opacity, animation: `petal-fall-rust ${p.duration}s ${p.delay}s ease-in infinite`,
          filter: i % 2 === 0 ? "blur(0.5px)" : "none",
          ["--sway" as string]: `${p.sway}px`,
          ["--petal-opacity" as string]: String(p.opacity),
        }}>{p.emoji}</span>
      ))}
    </div>
  );
}

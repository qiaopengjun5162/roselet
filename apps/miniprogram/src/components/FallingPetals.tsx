import { useEffect, useState } from "react";
import { View } from "@tarojs/components";
import { generatePetals } from "@/utils/wasm";

interface PetalConfig {
  emoji: string; left: number; size: number;
  duration: number; delay: number; sway: number; opacity: number;
}

const FALLBACK: PetalConfig[] = ["🌸","🌺","🌷","💮","🏵️","🌼","✿","❀","🌹","💐","🌻","🪷"].map((e, i) => ({
  emoji: e, left: (i * 8.7 + 3) % 100, size: 16 + ((i * 3.4) % 20),
  duration: 8 + ((i * 1.3) % 6), delay: (i * 1.7) % 8, sway: 20 + ((i * 7) % 40), opacity: 0.25,
}));

export function FallingPetals() {
  const [petals, setPetals] = useState<PetalConfig[]>([]);

  useEffect(() => {
    const p = generatePetals(12, 42);
    setPetals(p && p.length > 0 ? (p as PetalConfig[]) : FALLBACK);
  }, []);

  if (petals.length === 0) return null;

  return (
    <View
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: "none", zIndex: 1, overflow: "hidden",
      }}
    >
      {petals.map((p, i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-5%",
            fontSize: `${p.size}px`,
            opacity: p.opacity,
            animation: `petalFall ${p.duration}s ${p.delay}s ease-in infinite`,
          }}
        >
          {p.emoji}
        </View>
      ))}
    </View>
  );
}

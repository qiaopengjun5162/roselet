"use client";

import { useEffect, useState } from "react";
import { burstFireworks, getFireworkLaunches } from "@/lib/recommend";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  tx: number;
  ty: number;
  size: number;
  delay: number;
  duration: number;
}

export function Fireworks() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function launch() {
      const launches = await getFireworkLaunches();
      if (cancelled) return;

      const timers: ReturnType<typeof setTimeout>[] = [];
      let idCounter = 0;

      launches.forEach(({ cx, cy, count, delay_ms }: { cx: number; cy: number; count: number; delay_ms: number }) => {
        timers.push(setTimeout(async () => {
          if (cancelled) return;
          const offset = idCounter;
          idCounter += count;
          const ps = await burstFireworks(cx, cy, count, offset);
          if (cancelled) return;
          setParticles(prev => [...prev, ...ps]);
          setTimeout(() => {
            setParticles(prev => prev.filter(p => !ps.find((q: Particle) => q.id === p.id)));
          }, 1800);
        }, delay_ms));
      });

      return () => timers.forEach(clearTimeout);
    }

    launch();

    return () => { cancelled = true; };
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
            animation: `firework-spread ${p.duration}s ease-out ${p.delay}s both`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

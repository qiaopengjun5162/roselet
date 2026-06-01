"use client";

import { useEffect, useState } from "react";

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

const COLORS = [
  "#f43f5e", "#fb7185", "#e879f9", "#a78bfa",
  "#38bdf8", "#34d399", "#fbbf24", "#ffffff",
];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function burst(cx: number, cy: number, count: number, idOffset: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + randomBetween(-0.3, 0.3);
    const dist = randomBetween(60, 160);
    return {
      id: idOffset + i,
      x: cx,
      y: cy,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      tx: Math.cos(angle) * dist,
      ty: Math.sin(angle) * dist,
      size: randomBetween(4, 9),
      delay: randomBetween(0, 0.4),
      duration: randomBetween(0.7, 1.2),
    };
  });
}

export function Fireworks() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // 三轮爆炸，错开时间
    const launches = [
      { cx: 30,  cy: 30,  n: 18, t: 0   },
      { cx: 70,  cy: 20,  n: 22, t: 300 },
      { cx: 50,  cy: 40,  n: 20, t: 150 },
      { cx: 20,  cy: 55,  n: 16, t: 450 },
      { cx: 80,  cy: 45,  n: 18, t: 600 },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];
    let idCounter = 0;

    launches.forEach(({ cx, cy, n, t }) => {
      timers.push(setTimeout(() => {
        const ps = burst(cx, cy, n, idCounter);
        idCounter += n;
        setParticles(prev => [...prev, ...ps]);
        // 1.8s 后清理这批粒子
        setTimeout(() => {
          setParticles(prev => prev.filter(p => !ps.find(q => q.id === p.id)));
        }, 1800);
      }, t));
    });

    return () => timers.forEach(clearTimeout);
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

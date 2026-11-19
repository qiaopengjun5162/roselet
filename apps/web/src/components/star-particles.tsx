"use client";

import { useEffect, useState } from "react";
import { generateStarParticles, type StarParticle } from "@/lib/recommend";
import { prefersReducedMotion } from "@/lib/motion";

export function StarParticles() {
  const [particles, setParticles] = useState<StarParticle[]>([]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setReduced(true);
      return;
    }
    generateStarParticles(5, BigInt(Date.now())).then((p) => {
      if (p) setParticles(p);
    });
  }, []);

  if (reduced || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `star-fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

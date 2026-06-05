"use client";

import { useEffect, useState, type ReactNode } from "react";

interface StarBottleProps {
  children: ReactNode;
  delay?: number;
  glowColor?: string;
  className?: string;
}

export function StarBottle({ children, delay = 0, glowColor, className = "" }: StarBottleProps) {
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const animStyle = visible && !reduced
    ? { animation: `bottle-enter 600ms cubic-bezier(0.25,1,0.5,1) ${delay}ms both` }
    : { animation: "none" };

  return (
    <div
      className={`relative rounded-2xl border backdrop-blur-md transition-all duration-500
        bg-white/[0.03] border-white/[0.06]
        hover:bg-white/[0.06] hover:border-white/[0.14]
        ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(40px) scale(0.97)",
        "--bottle-glow": glowColor ?? "rgba(244,63,94,0.15)",
        ...animStyle,
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

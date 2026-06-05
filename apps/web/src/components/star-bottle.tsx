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

  return (
    <div
      className={`relative rounded-2xl border backdrop-blur-md transition-all duration-500 ${className}`}
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.06)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) scale(1)" : "translateY(40px) scale(0.97)",
        animation: visible && !reduced
          ? `bottle-enter 600ms cubic-bezier(0.25,1,0.5,1) ${delay}ms both`
          : "none",
        "--bottle-glow": glowColor ?? "rgba(244,63,94,0.15)",
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.14)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
      }}
    >
      {children}
    </div>
  );
}

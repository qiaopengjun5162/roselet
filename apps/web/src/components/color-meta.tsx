"use client";

import { colorEmoji, colorLabel } from "@/lib/recommend";

interface ColorMetaProps {
  color: string;
  className?: string;
}

export function ColorEmoji({ color, className }: ColorMetaProps) {
  return <span className={className}>{colorEmoji(color)}</span>;
}

export function ColorLabel({ color, className }: ColorMetaProps) {
  return <span className={className}>{colorLabel(color)}</span>;
}

export function ColorMeta({ color }: { color: string }) {
  return (
    <>
      <span className="text-3xl mb-2 block">{colorEmoji(color)}</span>
      <h3 className="font-semibold">{colorLabel(color)}</h3>
    </>
  );
}

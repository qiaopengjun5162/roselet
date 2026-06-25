"use client";

import { useEffect, useState } from "react";
import { getRecentActivity, type ActivityItem } from "@/lib/api";
import { colorEmoji, colorLabel, formatDate } from "@/lib/recommend";

interface FormattedActivity {
  id: string;
  text: string;
  time: string;
}

export function ActivityFeed() {
  const [items, setItems] = useState<FormattedActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const raw = await getRecentActivity();
        const formatted = await Promise.all(raw.map(formatActivity));
        if (!alive) return;
        setItems(formatted);
      } catch {
        if (!alive) return;
        setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl animate-pulse rounded-2xl glass-card p-4 h-16" aria-hidden="true" />
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl space-y-2">
      <p className="text-center text-[11px] tracking-wider text-amber-200/60">星空动态</p>
      <div className="rounded-2xl glass-card p-4 space-y-2 shadow-[0_0_24px_rgba(244,63,94,0.06)]">
        {items.slice(0, 5).map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-slate-200">{item.text}</span>
            <span className="shrink-0 text-xs text-slate-500">{item.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

async function formatActivity(item: ActivityItem): Promise<FormattedActivity> {
  const date = await formatDate(item.created_at);
  const time = date?.relative ?? "";
  if (item.kind === "announcement") {
    return { id: item.id, text: item.actor, time };
  }

  const label = colorLabel(item.color) || "玫瑰";
  const emoji = colorEmoji(item.color) || "🌹";
  if (item.kind === "gifted" && item.recipient) {
    return {
      id: item.id,
      text: `${emoji} ${item.actor} 送给 ${item.recipient} 一朵${label}`,
      time,
    };
  }
  return {
    id: item.id,
    text: `${emoji} ${item.actor} 种下一朵${label}`,
    time,
  };
}

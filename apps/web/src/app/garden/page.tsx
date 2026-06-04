"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { RoseCard } from "@/components/rose-card";
import { getGarden, type Rose } from "@/lib/api";
import { connectGardenWs } from "@/lib/ws";
import { playNotify } from "@/lib/sound";
import { getLayout, filterRosesInWasm, type GardenLayout } from "@/lib/recommend";

const FILTERS = [
  { value: "", label: "全部" },
  { value: "red", label: "红玫瑰" },
  { value: "white", label: "白玫瑰" },
  { value: "yellow", label: "黄玫瑰" },
];

export default function GardenPage() {
  const [roses, setRoses] = useState<Rose[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [colorFilter, setColorFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState<GardenLayout | null>(null);
  // Rust 驱动的过滤结果
  const [rustFiltered, setRustFiltered] = useState<Rose[] | null>(null);

  // Rust 排版计算
  useEffect(() => {
    if (typeof window !== "undefined") {
      getLayout(window.innerWidth).then(setLayout);
      const onResize = () => getLayout(window.innerWidth).then(setLayout);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, []);

  // Rust 驱动过滤
  useEffect(() => {
    if (roses.length > 0) {
      filterRosesInWasm(roses, colorFilter).then(r => {
        if (r) setRustFiltered(r);
      });
    } else {
      setRustFiltered(null);
    }
  }, [roses, colorFilter]);

  // Fallback: 本地过滤（WASM 未加载时）
  const displayed = rustFiltered ?? (colorFilter ? roses.filter(r => r.color === colorFilter) : roses);

  const loadRoses = (p: number, color?: string) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    getGarden(p, 20, color)
      .then(res => { setRoses(prev => p === 1 ? res.data : [...prev, ...res.data]); setTotal(res.total); setPage(p); })
      .catch(() => setError("加载花圃失败"))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  };

  useEffect(() => { loadRoses(1, colorFilter || undefined); }, [colorFilter]);

  useEffect(() => {
    const disconnect = connectGardenWs((rose) => {
      setRoses(prev => [rose as Rose, ...prev]);
      setTotal(t => t + 1);
      playNotify();
    });
    return disconnect;
  }, []);

  const gridStyle = layout ? {
    gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
    gap: `${layout.gap}px`,
    padding: `0 ${layout.padding_x}px`,
  } : {};

  return (
    <main className="relative h-full px-4 pb-4 pt-24 z-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex gap-2 mt-6">
          {FILTERS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setColorFilter(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                colorFilter === opt.value
                  ? "bg-rose-600/20 border border-rose-500/40 text-rose-400"
                  : "bg-white/5 border border-white/10 text-slate-400 hover:border-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-slate-500 text-center mt-20">加载中...</p>
        ) : error ? (
          <p className="text-slate-500 text-center mt-20">{error}</p>
        ) : displayed.length === 0 ? (
          <p className="text-slate-500 text-center mt-20">花圃还是空的，去种一朵花吧</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={layout ? gridStyle : undefined}>
              {displayed.map(rose => <RoseCard key={rose.id} rose={rose} showNickname />)}
            </div>
            {displayed.length < total && (
              <div className="text-center pt-4">
                <button
                  onClick={() => loadRoses(page + 1, colorFilter || undefined)}
                  disabled={loadingMore}
                  className="px-6 py-2 rounded-full border border-white/10 text-slate-400 text-sm hover:border-white/20 disabled:opacity-50"
                >
                  {loadingMore ? "加载中..." : "加载更多"}
                </button>
              </div>
            )}
          </>
        )}

        {layout && (
          <p className="text-center text-xs text-slate-600">
            Rust 排版引擎 · {layout.columns} 列 · 卡片宽 {layout.card_width}px · 间距 {layout.gap}px
          </p>
        )}
      </div>
    </main>
  );
}

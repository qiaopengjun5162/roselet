"use client";

import { useEffect, useState } from "react";
import { RoseCard } from "@/components/rose-card";
import { getGarden, type Rose } from "@/lib/api";
import { connectGardenWs } from "@/lib/ws";
import { playNotify } from "@/lib/sound";
import { getLayout, type GardenLayout } from "@/lib/recommend";
import { useWasmStore } from "@/lib/useWasmStore";

const FILTERS = [
  { value: "", label: "全部" },
  { value: "red", label: "红玫瑰" },
  { value: "white", label: "白玫瑰" },
  { value: "yellow", label: "黄玫瑰" },
];

export default function GardenPage() {
  const { items, total, hasMore, loading, error, filter, dispatch, ready } = useWasmStore();
  const [layout, setLayout] = useState<GardenLayout | null>(null);

  // Rust 排版计算
  useEffect(() => {
    if (typeof window !== "undefined") {
      getLayout(window.innerWidth).then(setLayout);
      const onResize = () => getLayout(window.innerWidth).then(setLayout);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }
  }, []);

  function loadRoses(page: number, color?: string) {
    if (page === 1) dispatch({ type: "set_loading", loading: true });
    getGarden(page, 20, color)
      .then(res => {
        if (page === 1) {
          dispatch({ type: "set_roses", roses: res.data as unknown[], total: res.total, page: res.page });
        } else {
          dispatch({ type: "append_roses", roses: res.data as unknown[], page: res.page });
        }
      })
      .catch(() => dispatch({ type: "set_error", error: "加载花圃失败" }));
  }

  useEffect(() => { loadRoses(1, filter === "all" ? undefined : filter); }, [filter]);

  useEffect(() => {
    const disconnect = connectGardenWs((rose) => {
      // 新玫瑰通过 WebSocket 到达，追加到列表
      dispatch({ type: "set_roses", roses: [rose as unknown, ...items] as unknown[], total: total + 1, page: 1 });
      playNotify();
    });
    return disconnect;
  }, [items, total]);

  const gridStyle = layout ? {
    gridTemplateColumns: `repeat(${layout.columns}, 1fr)`,
    gap: `${layout.gap}px`,
  } : {};

  return (
    <main className="relative h-full px-4 pb-4 pt-24 z-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex gap-2 mt-6">
          {FILTERS.map(opt => (
            <button
              key={opt.value}
              onClick={() => dispatch({ type: "set_filter", filter: opt.value })}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                filter === opt.value
                  ? "bg-rose-600/20 border border-rose-500/40 text-rose-400"
                  : "bg-white/5 border border-white/10 text-slate-400 hover:border-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {ready && <span className="text-xs text-emerald-500/60 self-center ml-2">⚡Rust</span>}
        </div>

        {loading ? (
          <p className="text-slate-500 text-center mt-20">加载中...</p>
        ) : error ? (
          <p className="text-red-400 text-center mt-20">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500 text-center mt-20">花圃还是空的，去种一朵花吧</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={layout ? gridStyle : undefined}>
              {items.map((rose: any) => <RoseCard key={rose.id} rose={rose as Rose} showNickname />)}
            </div>
            {hasMore && (
              <div className="text-center pt-4">
                <button
                  onClick={() => loadRoses((items.length / 20) + 1, filter === "all" ? undefined : filter)}
                  className="px-6 py-2 rounded-full border border-white/10 text-slate-400 text-sm hover:border-white/20"
                >
                  加载更多
                </button>
              </div>
            )}
          </>
        )}

        {layout && (
          <p className="text-center text-xs text-slate-600">
            Rust 排版 · {layout.columns} 列 · 卡片宽 {layout.card_width}px
          </p>
        )}
      </div>
    </main>
  );
}

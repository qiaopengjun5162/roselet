"use client";

import { useEffect, useState } from "react";
import { RoseCard } from "@/components/rose-card";
import { getGarden, type Rose } from "@/lib/api";
import { loadGardenCache } from "@/lib/garden-cache";
import { connectGardenWs } from "@/lib/ws";
import { playNotify } from "@/lib/sound";

const FILTERS = [
  { value: "", label: "全部" },
  { value: "red", label: "红玫瑰" },
  { value: "white", label: "白玫瑰" },
  { value: "yellow", label: "黄玫瑰" },
];

export default function GardenPage() {
  const [roses, setRoses] = useState<Rose[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadGardenCache().then((cache) => {
      if (!cache || cache.filter || cache.roses.length === 0) return;
      setRoses(cache.roses);
      setTotal(cache.total);
      setPage(cache.page);
      setLoading(false);
    });
  }, []);

function loadRoses(pageNum: number, color?: string) {
    setLoading(true);
    setError("");
    getGarden(pageNum, 20, color)
      .then((res) => {
        if (pageNum === 1) setRoses(res.data); else setRoses((prev) => [...prev, ...res.data]);
        setTotal(res.total);
        setPage(res.page);
      })
      .catch(() => setError("加载花圃失败"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadRoses(1, filter || undefined); }, [filter]);

  useEffect(() => {
    const disconnect = connectGardenWs((rose) => {
      setRoses((prev) => [rose, ...prev]);
      setTotal((t) => t + 1);
      playNotify();
    });
    return disconnect;
  }, []);

  return (
    <main className="relative h-full px-4 pb-4 pt-24 z-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex gap-2 mt-6">
          {FILTERS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilter(opt.value); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm transition-all ${
                filter === opt.value
                  ? "bg-rose-600/20 border border-rose-500/40 text-rose-400"
                  : "bg-white/5 border border-white/10 text-slate-400 hover:border-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading && roses.length === 0 ? (
          <p className="text-slate-500 text-center mt-20">加载中...</p>
        ) : error && roses.length === 0 ? (
          <p className="text-red-400 text-center mt-20">{error}</p>
        ) : roses.length === 0 ? (
          <p className="text-slate-500 text-center mt-20">花圃还是空的，去种一朵花吧</p>
        ) : (
          <>
            {error && (
              <p className="text-amber-400 text-center text-sm">
                {error}，先看看上次缓存的花圃吧
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roses.map((rose) => <RoseCard key={rose.id} rose={rose} showNickname />)}
            </div>
            {page * 20 < total && (
              <div className="text-center pt-4">
                <button
                  onClick={() => loadRoses(page + 1, filter || undefined)}
                  className="px-6 py-2 rounded-full border border-white/10 text-slate-400 text-sm hover:border-white/20"
                >
                  加载更多
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

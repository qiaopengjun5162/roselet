"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RoseCard } from "@/components/rose-card";
import { getGarden, type Rose } from "@/lib/api";
import { connectGardenWs } from "@/lib/ws";
import { playNotify } from "@/lib/sound";

export default function GardenPage() {
  const [roses, setRoses] = useState<Rose[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [colorFilter, setColorFilter] = useState<string>("");

  const filtered = colorFilter ? roses.filter(r => r.color === colorFilter) : roses;

  const loadRoses = (p: number, color?: string) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
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

  return (
    <main className="relative h-full px-4 pb-4 pt-24 z-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex gap-2 mt-6">
          {[{ value: "", label: "全部" }, { value: "red", label: "红玫瑰" }, { value: "white", label: "白玫瑰" }, { value: "yellow", label: "黄玫瑰" }].map(opt => (
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
        {loading ? <p className="text-slate-500 text-center mt-20">加载中...</p>
        : error ? <p className="text-slate-500 text-center mt-20">{error}</p>
        : filtered.length === 0 ? <p className="text-slate-500 text-center mt-20">花圃还是空的</p>
        : <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(rose => <RoseCard key={rose.id} rose={rose} showNickname />)}
          </div>
          {filtered.length < total && (
            <div className="text-center pt-4">
              <Button variant="outline" size="sm" onClick={() => loadRoses(page + 1, colorFilter || undefined)} disabled={loadingMore} className="border-white/10 text-slate-400">
                {loadingMore ? "加载中..." : "加载更多"}
              </Button>
            </div>
          )}
        </>}
      </div>
    </main>
  );
}

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

  const loadRoses = (p: number, color?: string) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);

    getGarden(p, 20, color)
      .then((res) => {
        setRoses((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
        setTotal(res.total);
        setPage(p);
      })
      .catch(() => setError("加载花圃失败"))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  };

  useEffect(() => {
    loadRoses(1, colorFilter || undefined);
  }, [colorFilter]);

  useEffect(() => {
    const disconnect = connectGardenWs((rose) => {
      setRoses((prev) => [rose as Rose, ...prev]);
      setTotal((t) => t + 1);
      playNotify();
    });
    return disconnect;
  }, []);

  return (
    <main className="relative min-h-screen px-4 pb-4 pt-16 z-10">
      <div className="max-w-4xl mx-auto space-y-6">
<div className="flex gap-2">
          {[{ value: "", label: "全部" }, { value: "red", label: "红玫瑰" }, { value: "white", label: "白玫瑰" }, { value: "yellow", label: "黄玫瑰" }].map((opt) => (
            <Button
              key={opt.value}
              variant={colorFilter === opt.value ? "default" : "outline"}
              size="sm"
              onClick={() => setColorFilter(opt.value)}
              className={colorFilter === opt.value ? "bg-rose-500/80 border-rose-400 text-white" : "glass-card border-white/10 text-slate-300 hover:border-white/25"}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground animate-pulse">加载中...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-red-500">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              重试
            </Button>
          </div>
        ) : roses.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-6xl">🌱</p>
            <p className="text-xl text-slate-400">花圃还是空的</p>
            <p className="text-sm text-slate-500">成为第一个种玫瑰的人吧</p>
            <Link href="/plant">
              <Button className="bg-rose-500 hover:bg-rose-600">
                种第一朵玫瑰
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              共 {total} 朵玫瑰
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roses.map((rose) => (
                <RoseCard key={rose.id} rose={rose} showNickname />
              ))}
            </div>
            {roses.length < total && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => loadRoses(page + 1, colorFilter || undefined)}
                  disabled={loadingMore}
                  className="glass-card border-white/15 text-slate-300 hover:border-white/30"
                >
                  {loadingMore ? "加载中..." : "加载更多"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGarden, type Rose } from "@/lib/api";
import { connectGardenWs } from "@/lib/ws";
import { playNotify } from "@/lib/sound";

const COLOR_MAP: Record<string, { emoji: string; label: string }> = {
  red: { emoji: "🌹", label: "红玫瑰" },
  white: { emoji: "🤍", label: "白玫瑰" },
  yellow: { emoji: "💛", label: "黄玫瑰" },
};

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
    <main className="relative min-h-screen p-4 z-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-rose-300">花圃</h1>
          <Link href="/plant">
            <Button className="bg-gradient-to-r from-rose-500 to-pink-500 hover:shadow-rose-500/40 hover:shadow-lg border-0">种一朵玫瑰</Button>
          </Link>
        </div>

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
              {roses.map((rose) => {
                const meta = COLOR_MAP[rose.color] || { emoji: "🌹", label: "玫瑰" };
                return (
                  <Link key={rose.id} href={`/rose/${rose.id}`}>
                    <Card className="glass-card hover:border-white/25 transition-all cursor-pointer h-full bg-transparent border-0">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-2xl">{meta.emoji}</span>
                          <span className="text-sm text-slate-500">{meta.label}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {rose.gratitude && (
                          <p><span className="font-medium text-yellow-400">🌹 </span>{rose.gratitude}</p>
                        )}
                        {rose.anxiety && (
                          <p><span className="font-medium text-sky-400">🌵 </span>{rose.anxiety}</p>
                        )}
                        {rose.hope && (
                          <p><span className="font-medium text-fuchsia-400">🌱 </span>{rose.hope}</p>
                        )}
                        <p className="text-xs text-slate-500 pt-2">
                          {rose.nickname && <span className="mr-2">{rose.nickname}</span>}
                          {rose.like_count > 0 && <span className="mr-2 text-rose-400">❤️ {rose.like_count}</span>}
                          {new Date(rose.created_at).toLocaleDateString("zh-CN")}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
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

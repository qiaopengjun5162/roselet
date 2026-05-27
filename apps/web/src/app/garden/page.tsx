"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGarden, type Rose } from "@/lib/api";

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

  const loadRoses = (p: number) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);

    getGarden(p)
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
    loadRoses(1);
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-rose-800">花圃</h1>
          <Link href="/plant">
            <Button className="bg-rose-500 hover:bg-rose-600">种一朵玫瑰</Button>
          </Link>
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
            <p className="text-xl text-muted-foreground">花圃还是空的</p>
            <p className="text-sm text-muted-foreground">成为第一个种玫瑰的人吧</p>
            <Link href="/plant">
              <Button className="bg-rose-500 hover:bg-rose-600">
                种第一朵玫瑰
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              共 {total} 朵玫瑰
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roses.map((rose) => {
                const meta = COLOR_MAP[rose.color] || { emoji: "🌹", label: "玫瑰" };
                return (
                  <Link key={rose.id} href={`/rose/${rose.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-2xl">{meta.emoji}</span>
                          <span className="text-sm text-muted-foreground">{meta.label}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {rose.gratitude && (
                          <p><span className="font-medium text-rose-600">感恩：</span>{rose.gratitude}</p>
                        )}
                        {rose.anxiety && (
                          <p><span className="font-medium text-amber-600">焦虑：</span>{rose.anxiety}</p>
                        )}
                        {rose.hope && (
                          <p><span className="font-medium text-green-600">期待：</span>{rose.hope}</p>
                        )}
                        <p className="text-xs text-muted-foreground pt-2">
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
                  onClick={() => loadRoses(page + 1)}
                  disabled={loadingMore}
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

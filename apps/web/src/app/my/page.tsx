"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RoseCard } from "@/components/rose-card";
import { getMyRoses, getToken, type Rose } from "@/lib/api";

export default function MyGardenPage() {
  const [roses, setRoses] = useState<Rose[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const loadRoses = useCallback((p: number) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    setError("");

    getMyRoses(p)
      .then((res) => {
        setRoses((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
        setTotal(res.total);
        setPage(p);
      })
      .catch(() => {
        if (!getToken()) {
          router.push("/login");
          return;
        }
        setError("加载花圃失败");
      })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    loadRoses(1);
  }, [loadRoses, router]);

  return (
    <main className="relative h-full px-4 pb-4 pt-16 z-10">
      <div className="max-w-4xl mx-auto space-y-6">
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
            <p className="text-xl text-slate-400">你还没有种过玫瑰</p>
            <Link href="/plant">
              <Button className="bg-gradient-to-r from-rose-500 to-pink-500 border-0">种第一朵玫瑰</Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500">共 {total} 朵玫瑰</p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roses.map((rose) => (
                <RoseCard key={rose.id} rose={rose} />
              ))}
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

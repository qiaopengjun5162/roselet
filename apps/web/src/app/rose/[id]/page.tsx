"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRose, type Rose } from "@/lib/api";

const COLOR_MAP: Record<string, { emoji: string; label: string; bg: string }> = {
  red: { emoji: "🌹", label: "红玫瑰", bg: "from-red-50 to-white" },
  white: { emoji: "🤍", label: "白玫瑰", bg: "from-gray-50 to-white" },
  yellow: { emoji: "💛", label: "黄玫瑰", bg: "from-amber-50 to-white" },
};

export default function RoseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [rose, setRose] = useState<Rose | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getRose(id)
      .then(setRose)
      .catch(() => setError("玫瑰不存在"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white p-4">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-muted-foreground animate-pulse">加载中...</p>
        </div>
      </main>
    );
  }

  if (error || !rose) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white p-4">
        <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
          <p className="text-red-500">{error || "玫瑰不存在"}</p>
          <Link href="/garden">
            <Button variant="outline">返回花圃</Button>
          </Link>
        </div>
      </main>
    );
  }

  const meta = COLOR_MAP[rose.color] || { emoji: "🌹", label: "玫瑰", bg: "from-rose-50 to-white" };

  return (
    <main className={`min-h-screen bg-gradient-to-b ${meta.bg} p-4`}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/garden">
            <Button variant="ghost" size="sm">← 返回花圃</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="text-4xl">{meta.emoji}</span>
              <div>
                <h1 className="text-2xl">{meta.label}</h1>
                <p className="text-sm text-muted-foreground font-normal">
                  {new Date(rose.created_at).toLocaleString("zh-CN")}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {rose.gratitude && (
              <div className="space-y-2">
                <h3 className="font-medium text-rose-600">🌹 感恩</h3>
                <p className="text-lg leading-relaxed bg-rose-50 p-4 rounded-lg">
                  {rose.gratitude}
                </p>
              </div>
            )}
            {rose.anxiety && (
              <div className="space-y-2">
                <h3 className="font-medium text-amber-600">🌿 焦虑</h3>
                <p className="text-lg leading-relaxed bg-amber-50 p-4 rounded-lg">
                  {rose.anxiety}
                </p>
              </div>
            )}
            {rose.hope && (
              <div className="space-y-2">
                <h3 className="font-medium text-green-600">🌱 期待</h3>
                <p className="text-lg leading-relaxed bg-green-50 p-4 rounded-lg">
                  {rose.hope}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/plant">
            <Button className="bg-rose-500 hover:bg-rose-600">种一朵玫瑰</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRose, updateRose, getUser, toggleLike, type Rose } from "@/lib/api";
import { playClick, playPlant, playLike } from "@/lib/sound";
import { RosePlayer } from "@/components/rose-player";
import { colorEmoji, colorLabel } from "@/lib/recommend";

function resolveRoseId(id: string): string {
  if (id !== "placeholder" || typeof window === "undefined") return id;
  const match = window.location.pathname.match(/^\/rose\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : id;
}

export function RoseDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const roseId = resolveRoseId(id);
  const [rose, setRose] = useState<Rose | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const user = getUser();
  const isOwner = user && rose && rose.user_id === user.id;

  useEffect(() => {
    getRose(roseId)
      .then(setRose)
      .catch(() => setError("玫瑰不存在"))
      .finally(() => setLoading(false));
  }, [roseId]);

  function toggleSettings() {
    playClick();
    setSettingsOpen((open) => !open);
  }

  async function makePrivate() {
    if (!rose) return;
    setSaving(true);
    try {
      const updated = await updateRose(rose.id, { is_private: true });
      setRose(updated);
      setSettingsOpen(false);
      playPlant();
    } catch {
      setError("设置失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleLike() {
    if (!rose) return;
    if (!user) {
      router.push(`/login?redirect=/rose/${rose.id}`);
      return;
    }
    try {
      const res = await toggleLike(rose.id);
      setRose({ ...rose, like_count: res.like_count });
      playLike();
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <main className="relative h-full px-4 pb-8 pt-16 z-10">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-slate-400 animate-pulse">加载中...</p>
        </div>
      </main>
    );
  }

  if (error || !rose) {
    return (
      <main className="relative h-full px-4 pb-8 pt-10 z-10">
        <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
          <p className="text-red-500">{error || "玫瑰不存在"}</p>
          <Link href="/garden">
            <Button variant="outline">返回花圃</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-full px-4 pb-8 pt-10 z-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/garden">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-rose-300 hover:bg-white/5">← 返回花圃</Button>
          </Link>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={toggleSettings} className="border-white/20 text-slate-300 hover:border-white/40">
              玫瑰设置
            </Button>
          )}
        </div>

        <Card className="glass-card border-0 bg-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="text-4xl">{colorEmoji(rose.color)}</span>
              <div>
                <h1 className="text-2xl font-bold text-slate-100">{colorLabel(rose.color)}</h1>
                <p className="text-sm text-slate-400 font-normal">
                  {rose.nickname && <span className="mr-2">{rose.nickname}</span>}
                  {new Date(rose.created_at).toLocaleString("zh-CN")}
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {settingsOpen && isOwner && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">玫瑰设置</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    种下后的文字会保留下来，不再改写；这里先放只影响可见性的设置。
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-100">设为私密</p>
                    <p className="mt-1 text-xs text-slate-400">设为私密后只给你自己看，暂不支持重新公开。</p>
                  </div>
                  {rose.is_private ? (
                    <span className="whitespace-nowrap rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200">已私密</span>
                  ) : rose.is_gift ? (
                    <span className="whitespace-nowrap rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-200" title="已送给别人的玫瑰不能转为私密">已送礼</span>
                  ) : (
                    <Button size="sm" onClick={makePrivate} disabled={saving} className="bg-rose-500 hover:bg-rose-600">
                      {saving ? "设置中..." : "设为私密"}
                    </Button>
                  )}
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <p className="text-sm font-medium text-slate-100">送给别人</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {rose.is_gift
                      ? `这朵玫瑰已送给 ${rose.recipient_nickname}。`
                      : "已种下的玫瑰暂不支持事后补送，想送人请在种花时填写对方昵称。"}
                  </p>
                </div>
              </div>
            )}
            {rose.gratitude && (
              <div className="space-y-2">
                <h3 className="font-medium text-rose-600">感恩</h3>
                <p className="text-base leading-relaxed bg-rose-900/20 border border-rose-500/20 p-4 rounded-lg text-slate-200">{rose.gratitude}</p>
              </div>
            )}
            {rose.anxiety && (
              <div className="space-y-2">
                <h3 className="font-medium text-amber-600">焦虑</h3>
                <p className="text-base leading-relaxed bg-amber-900/20 border border-amber-500/20 p-4 rounded-lg text-slate-200">{rose.anxiety}</p>
              </div>
            )}
            {rose.hope && (
              <div className="space-y-2">
                <h3 className="font-medium text-green-600">期待</h3>
                <p className="text-base leading-relaxed bg-green-900/20 border border-green-500/20 p-4 rounded-lg text-slate-200">{rose.hope}</p>
              </div>
            )}
            {rose.is_gift && rose.recipient_nickname && (
              <div className="space-y-2 pt-4 border-t border-pink-500/20">
                <p className="text-sm text-purple-400">
                  {rose.user_id && user && rose.user_id === user.id
                    ? `💝 你送给了 ${rose.recipient_nickname}`
                    : rose.recipient_nickname && user && rose.recipient_nickname === user.nickname
                      ? `💝 ${rose.nickname || "匿名"} 送给了你`
                      : `💝 ${rose.nickname || "匿名"} 送给了 ${rose.recipient_nickname}`
                  }
                </p>
              </div>
            )}
            {rose.ai_reply && (
              <div className="space-y-2 pt-4 border-t border-white/10">
                <h3 className="font-medium text-purple-600">AI 回复</h3>
                <p className="text-base leading-relaxed bg-purple-900/20 border border-purple-500/20 p-4 rounded-lg text-slate-300 italic">{rose.ai_reply}</p>
              </div>
            )}
            <div className="pt-4 border-t border-white/10 flex items-center gap-4 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLike}
              >
                {rose.like_count > 0 ? `❤️ ${rose.like_count}` : "❤️ 点赞"}
              </Button>
            </div>
            <div className="pt-2 flex justify-center">
              <RosePlayer rose={rose} canvasSize={160} />
            </div>
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

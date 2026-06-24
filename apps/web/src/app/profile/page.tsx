"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deactivateAccount, getToken, getUserProfile, type UserProfile } from "@/lib/api";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivating, setDeactivating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    getUserProfile()
      .then(setProfile)
      .catch(() => {
        if (!getToken()) {
          router.push("/login");
          return;
        }
        setError("加载资料失败");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const copyUserId = async () => {
    if (!profile?.user.id) return;
    try {
      await navigator.clipboard.writeText(profile.user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <main className="relative h-full px-4 pb-4 pt-16 z-10">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-slate-400 animate-pulse">加载中...</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="relative h-full px-4 pb-4 pt-16 z-10">
        <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
          <p className="text-red-400">{error || "加载失败"}</p>
          <Link href="/garden">
            <Button variant="outline">返回花圃</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-full px-4 pb-4 pt-16 z-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-lg font-semibold text-rose-300">个人资料</h1>

        <Card className="border-white/10 bg-slate-900/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-100">{profile.user.nickname}</CardTitle>
            <p className="text-sm text-slate-400">
              注册于 {new Date(profile.user.created_at).toLocaleDateString("zh-CN")}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {notice ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {notice}
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">User ID</p>
                <p className="truncate font-mono text-sm text-slate-300">{profile.user.id}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-slate-400 hover:text-slate-100"
                onClick={copyUserId}
              >
                {copied ? "已复制" : "复制"}
              </Button>
            </div>

            <div className="text-center py-4">
              <p className="text-5xl font-bold text-rose-400">{profile.total_roses}</p>
              <p className="text-slate-400">朵玫瑰</p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4">
                <p className="text-3xl">🌹</p>
                <p className="text-2xl font-bold text-red-400">{profile.red_count}</p>
                <p className="text-sm text-slate-400">红玫瑰</p>
              </div>
              <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
                <p className="text-3xl">🤍</p>
                <p className="text-2xl font-bold text-slate-200">{profile.white_count}</p>
                <p className="text-sm text-slate-400">白玫瑰</p>
              </div>
              <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
                <p className="text-3xl">💛</p>
                <p className="text-2xl font-bold text-amber-400">{profile.yellow_count}</p>
                <p className="text-sm text-slate-400">黄玫瑰</p>
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              <Link href="/my">
                <Button variant="outline">我的花圃</Button>
              </Link>
              <Link href="/plant">
                <Button className="bg-rose-500 hover:bg-rose-600">种一朵玫瑰</Button>
              </Link>
            </div>

            <div className="rounded-xl border border-red-900/30 bg-red-950/20 p-4 space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-red-300">注销账号</h2>
                <p className="text-sm text-red-200/80">
                  注销后会立即退出登录，30 天内可用原昵称重新登录恢复账号；过期后昵称会被释放，已种下的玫瑰会保留但昵称匿名化。
                </p>
              </div>
              <Button
                variant="outline"
                className="border-red-800 text-red-300 hover:bg-red-950/50 hover:text-red-200"
                disabled={deactivating}
                onClick={async () => {
                  if (!window.confirm("确认注销账号吗？30 天内可用原昵称恢复。")) return;
                  setDeactivating(true);
                  setError("");
                  setNotice("");
                  try {
                    const result = await deactivateAccount("user_requested");
                    setNotice(
                      `账号已进入冷却期，可在 ${new Date(result.restore_deadline).toLocaleDateString("zh-CN")} 前恢复。`,
                    );
                    router.push("/login");
                  } catch {
                    setError("注销失败，请稍后再试");
                  } finally {
                    setDeactivating(false);
                  }
                }}
              >
                {deactivating ? "注销中..." : "注销账号"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

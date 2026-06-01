"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getToken, getUserProfile, type UserProfile } from "@/lib/api";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    getUserProfile()
      .then(setProfile)
      .catch(() => setError("加载资料失败"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white pt-16">
        <div className="max-w-2xl mx-auto text-center py-20">
          <p className="text-muted-foreground animate-pulse">加载中...</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white p-4">
        <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
          <p className="text-red-500">{error || "加载失败"}</p>
          <Link href="/garden">
            <Button variant="outline">返回花圃</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-white p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-lg font-semibold text-rose-300">个人资料</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{profile.user.nickname}</CardTitle>
            <p className="text-sm text-muted-foreground">
              注册于 {new Date(profile.user.created_at).toLocaleDateString("zh-CN")}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-4">
              <p className="text-5xl font-bold text-rose-600">{profile.total_roses}</p>
              <p className="text-muted-foreground">朵玫瑰</p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-3xl">🌹</p>
                <p className="text-2xl font-bold text-red-600">{profile.red_count}</p>
                <p className="text-sm text-muted-foreground">红玫瑰</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-3xl">🤍</p>
                <p className="text-2xl font-bold text-gray-600">{profile.white_count}</p>
                <p className="text-sm text-muted-foreground">白玫瑰</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-3xl">💛</p>
                <p className="text-2xl font-bold text-amber-600">{profile.yellow_count}</p>
                <p className="text-sm text-muted-foreground">黄玫瑰</p>
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

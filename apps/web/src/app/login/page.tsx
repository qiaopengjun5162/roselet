"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { register, setToken, setRefreshToken, setUser } from "@/lib/api";

function LoginForm() {
  const [nickname, setNickname] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/garden";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await register(nickname.trim(), passphrase || undefined);
      setToken(res.access_token);
      setRefreshToken(res.refresh_token);
      setUser(res.user);
      window.dispatchEvent(new Event("auth-change"));
      router.push(redirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("密码错误")) {
        setError("密码错误");
      } else if (msg.includes("正在冷却期内")) {
        setError("这个昵称正在 30 天冷却期内，如要恢复账号请输入原密码");
      } else if (msg.includes("已设置密码")) {
        setError("该昵称已设置密码，请输入密码");
      } else {
        setError("登录失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-2">给自己取个名字</h1>
        <p className="text-muted-foreground text-center mb-6">
          起个昵称就能开始种花，已有昵称直接进入；注销后 30 天内也能用原昵称恢复
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="你想叫什么名字？"
              maxLength={50}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              autoFocus
            />
          </div>
          <div>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="密码（可选，设了更安全）"
              maxLength={100}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !nickname.trim()}
            className="w-full py-3 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "进入中..." : "进入花圃"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

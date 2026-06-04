"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser, logout, type User } from "@/lib/api";
import { isMuted, toggleMute, startBgMusic, stopBgMusic } from "@/lib/sound";

export function Nav() {
  const [user, setUser] = useState<User | null>(null);
  const [muted, setMuted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setUser(getUser());
    setMuted(isMuted());
    function onAuthChange() { setUser(getUser()); }
    window.addEventListener("auth-change", onAuthChange);
    return () => window.removeEventListener("auth-change", onAuthChange);
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
    router.push("/");
  }

  return (
    <nav className="flex gap-1 items-center">
      <button
        onClick={() => { const now = toggleMute(); setMuted(now); now ? stopBgMusic() : startBgMusic(); }}
        className="text-sm text-slate-300 hover:text-rose-300 transition-colors px-2 py-1 rounded-md hover:bg-white/5"
      >
        {muted ? "🔇" : "🔊"}
      </button>
      <Link href="/plant" className="text-sm text-slate-300 hover:text-rose-300 transition-colors px-2 py-1 rounded-md hover:bg-white/5">种玫瑰</Link>
      <Link href="/garden" className="text-sm text-slate-300 hover:text-rose-300 transition-colors px-2 py-1 rounded-md hover:bg-white/5">花圃</Link>
      <Link href="/oscilloscope" className="text-sm text-slate-300 hover:text-purple-300 transition-colors px-2 py-1 rounded-md hover:bg-white/5">示波器</Link>
      {user ? (
        <>
          <Link href="/my" className="text-sm text-slate-300 hover:text-rose-300 transition-colors px-2 py-1 rounded-md hover:bg-white/5">我的花圃</Link>
          <Link href="/profile" className="text-sm text-rose-400 hover:text-rose-300 font-medium transition-colors px-2 py-1 rounded-md hover:bg-white/5">{user.nickname}</Link>
          <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded-md hover:bg-white/5">登出</button>
        </>
      ) : (
        <Link href="/login" className="text-sm text-rose-400 font-medium hover:text-rose-300 transition-colors px-2 py-1">登录</Link>
      )}
    </nav>
  );
}

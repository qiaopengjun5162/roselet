"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout, setToken, setUser } from "@/lib/api";
import { isMuted, toggleMute, startBgMusic, stopBgMusic } from "@/lib/sound";
import { useWasmStore } from "@/lib/useWasmStore";

const MAIN_LINKS = [
  { href: "/plant", label: "种玫瑰", icon: "🌹" },
  { href: "/garden", label: "花圃", icon: "🌸" },
  { href: "/oscilloscope", label: "示波器", icon: "🎵" },
];

export function Nav() {
  const [muted, setMuted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { auth, nickname, dispatch } = useWasmStore();

  useEffect(() => { setMuted(isMuted()); }, []);

  function handleLogout() {
    logout();
    dispatch({ type: "clear_auth" });
    router.push("/");
  }

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <nav className="flex items-center gap-0.5">
      {MAIN_LINKS.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className={`text-[13px] px-3 py-1.5 rounded-full transition-all duration-200 ${
            isActive(link.href)
              ? "bg-rose-500/15 text-rose-300 font-medium"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
        >
          <span className="mr-1">{link.icon}</span>{link.label}
        </Link>
      ))}

      <span className="w-px h-5 bg-white/8 mx-1.5" />

      {auth ? (
        <>
          <Link
            href="/my"
            className={`text-[13px] px-3 py-1.5 rounded-full transition-all duration-200 ${
              isActive("/my") ? "bg-rose-500/15 text-rose-300 font-medium" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            🌺 我的
          </Link>
          <Link
            href="/profile"
            className="text-[13px] px-3 py-1.5 rounded-full transition-all duration-200 text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/5"
          >
            ✨ {nickname}
          </Link>
          <button onClick={handleLogout} className="text-[12px] text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors ml-1">
            登出
          </button>
        </>
      ) : (
        <Link
          href="/login"
          className="text-[13px] px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 transition-all font-medium"
        >
          登录
        </Link>
      )}

      <button
        onClick={() => { const now = toggleMute(); setMuted(now); now ? stopBgMusic() : startBgMusic(); }}
        className="text-[13px] text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors ml-1"
        title={muted ? "开启声音" : "关闭声音"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </nav>
  );
}

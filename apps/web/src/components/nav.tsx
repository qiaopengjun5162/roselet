"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout, getUser } from "@/lib/api";
import { isMuted, toggleMute, startBgMusic, stopBgMusic } from "@/lib/sound";

const MAIN_LINKS = [
  { href: "/plant", label: "种玫瑰", icon: "🌹" },
  { href: "/garden", label: "花圃", icon: "🌸" },
  { href: "/oscilloscope", label: "示波器", icon: "🎵" },
  { href: "/about", label: "关于", icon: "ℹ️" },
];

export function Nav() {
  const [muted, setMuted] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const refreshAuth = useCallback(() => {
    const user = getUser();
    setNickname(user?.nickname ?? null);
  }, []);

  useEffect(() => { setMuted(isMuted()); refreshAuth(); }, [refreshAuth]);
  useEffect(() => {
    window.addEventListener("auth-change", refreshAuth);
    return () => window.removeEventListener("auth-change", refreshAuth);
  }, [refreshAuth]);

  function handleLogout() {
    logout();
    setNickname(null);
    setMenuOpen(false);
    router.push("/");
  }

  const authed = !!nickname;
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <nav className="flex items-center gap-0.5">
      {MAIN_LINKS.map(link => (
        <Link
          key={link.href}
          href={link.href}
          className={`shrink-0 whitespace-nowrap text-[13px] px-3 py-1.5 rounded-full transition-all duration-200 ${
            isActive(link.href)
              ? "bg-rose-500/15 text-rose-300 font-medium"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
        >
          <span className="sm:mr-1">{link.icon}</span><span className="hidden sm:inline">{link.label}</span>
        </Link>
      ))}

      <span className="w-px h-5 bg-white/8 mx-1.5" />

      {authed ? (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`shrink-0 whitespace-nowrap text-[13px] px-3 py-1.5 rounded-full transition-all duration-200 ${
              menuOpen ? "bg-rose-500/15 text-rose-300" : "text-amber-300/80 hover:text-amber-200 hover:bg-amber-500/5"
            }`}
          >
            ✨ {nickname} ▾
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-36 py-1 rounded-xl bg-[#0f081e]/95 border border-white/10 backdrop-blur-xl shadow-xl z-50">
                <Link
                  href="/my"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-[13px] text-slate-300 hover:bg-white/5 hover:text-rose-300 transition-colors"
                >
                  🌺 我的花圃
                </Link>
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-[13px] text-slate-300 hover:bg-white/5 hover:text-rose-300 transition-colors"
                >
                  👤 个人资料
                </Link>
                <div className="border-t border-white/8 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-[13px] text-slate-500 hover:bg-white/5 hover:text-red-400 transition-colors"
                >
                  登出
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <Link
          href="/login"
          className="shrink-0 whitespace-nowrap text-[13px] px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 transition-all font-medium"
        >
          登录
        </Link>
      )}

      <button
        onClick={() => {
          const now = toggleMute();
          setMuted(now);
          if (now) stopBgMusic();
          else startBgMusic();
        }}
        className="text-[13px] text-slate-500 hover:text-slate-300 px-2 py-1 transition-colors ml-1"
        title={muted ? "开启声音" : "关闭声音"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </nav>
  );
}

import Link from "next/link";
import { TipTicker } from "@/components/tip-ticker";
import { ActivityFeed } from "@/components/activity-feed";

export default function Home() {
  return (
    <main className="relative h-full flex flex-col items-center justify-center p-6 z-10">
      {/* 中央光晕 */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-rose-500/8 blur-3xl pointer-events-none" />

      <div className="max-w-2xl w-full text-center space-y-10">
        {/* 标题 */}
        <div className="space-y-3">
          <div className="text-7xl" style={{filter: "drop-shadow(0 0 24px rgba(244,63,94,0.7))"}}>🌹</div>
          <h1 className="text-5xl font-bold font-brush text-transparent font-[KaiTi],楷体,serif bg-clip-text bg-gradient-to-r from-rose-300 via-pink-200 to-purple-300">
            Roselet
          </h1>
          <p className="text-xl tracking-[0.25em] font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-amber-100 drop-shadow-[0_0_30px_rgba(244,63,94,0.15)]">在星空下种下你的情绪，等待宇宙的回响</p>
        </div>

        <TipTicker context="home" />
        <ActivityFeed />

        {/* 三块说明 */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="glass-card p-5 space-y-2 glow-gratitude">
            <div className="text-3xl">🌹</div>
            <h3 className="font-semibold text-yellow-300">玫瑰</h3>
            <p className="text-sm text-slate-400 leading-relaxed">这周让你感到幸福或感恩的事情是什么？</p>
          </div>
          <div className="glass-card p-5 space-y-2 glow-hope">
            <div className="text-3xl">🌱</div>
            <h3 className="font-semibold text-fuchsia-300">花苞</h3>
            <p className="text-sm text-slate-400 leading-relaxed">你现在有什么期待的事情，或新灵感想实现？</p>
          </div>
          <div className="glass-card p-5 space-y-2 glow-anxiety">
            <div className="text-3xl">🌵</div>
            <h3 className="font-semibold text-sky-300">尖刺</h3>
            <p className="text-sm text-slate-400 leading-relaxed">有什么让你感到焦虑或需要帮助的事情？</p>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-4 justify-center">
          <Link href="/plant">
            <button className="px-8 py-3 rounded-full font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:-translate-y-0.5 transition-all">
              种一朵玫瑰
            </button>
          </Link>
          <Link href="/garden">
            <button className="px-8 py-3 rounded-full font-semibold text-sm glass-card text-slate-200 hover:-translate-y-0.5 transition-all">
              参观花圃
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}

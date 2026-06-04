"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createRose, getToken, getMyRoses } from "@/lib/api";
import { playClick, playPlant, playComplete } from "@/lib/sound";
import { getRecommendation, type Recommendation } from "@/lib/recommend";
import { Fireworks } from "@/components/fireworks";
import { RosePlayer } from "@/components/rose-player";

const COLORS = [
  { id: "red", label: "红玫瑰", emoji: "🌹", gradient: "from-red-100 to-red-50", accent: "text-red-600" },
  { id: "white", label: "白玫瑰", emoji: "🤍", gradient: "from-gray-100 to-gray-50", accent: "text-gray-600" },
  { id: "yellow", label: "黄玫瑰", emoji: "💛", gradient: "from-amber-100 to-amber-50", accent: "text-amber-600" },
] as const;

type Field = "gratitude" | "anxiety" | "hope";

const FIELD_CONFIG: Record<Field, { label: string; placeholder: string; hint: string; color: string; icon: string }> = {
  gratitude: {
    label: "玫瑰",
    placeholder: "这周让你感到幸福或感恩的事情是...",
    hint: "一件让你感恩的事",
    color: "text-rose-600",
    icon: "🌹",
  },
  anxiety: {
    label: "尖刺",
    placeholder: "现在有什么让你感到焦虑或需要帮助的...",
    hint: "有什么让你焦虑",
    color: "text-amber-600",
    icon: "🌵",
  },
  hope: {
    label: "花苞",
    placeholder: "你现在期待的事情或新灵感...",
    hint: "你现在有什么期待",
    color: "text-green-600",
    icon: "🌱",
  },
};

export default function PlantPage() {
  const router = useRouter();
  const [step, setStep] = useState<"color" | "interactive" | "success">("color");
  const [color, setColor] = useState<string>("");
  const [activeField, setActiveField] = useState<Field | null>(null);
  const [gratitude, setGratitude] = useState("");
  const [anxiety, setAnxiety] = useState("");
  const [hope, setHope] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  const hasContent = gratitude.trim() || anxiety.trim() || hope.trim();

  // 未登录跳转登录页，登录后跳回种花页
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login?redirect=/plant");
    }
  }, [router]);

  // 加载 WASM 推荐
  useEffect(() => {
    if (!getToken()) return;
    setRecLoading(true);
    getMyRoses(1, 10)
      .then((res) => {
        const roses = res.data.map((r) => ({
          color: r.color,
          gratitude: r.gratitude,
          anxiety: r.anxiety,
          hope: r.hope,
        }));
        return getRecommendation(roses);
      })
      .then((r) => { if (r) setRec(r); })
      .finally(() => setRecLoading(false));
  }, []);

  const colorMeta = COLORS.find((c) => c.id === color);

  function getFieldValue(field: Field): string {
    if (field === "gratitude") return gratitude;
    if (field === "anxiety") return anxiety;
    return hope;
  }

  function setFieldValue(field: Field, value: string) {
    if (field === "gratitude") setGratitude(value);
    else if (field === "anxiety") setAnxiety(value);
    else setHope(value);
  }

  function isFieldFilled(field: Field): boolean {
    return getFieldValue(field).trim().length > 0;
  }

  async function handleSubmit() {
    if (!hasContent) return;
    setSubmitting(true);
    setError("");
    playPlant();

    try {
      await createRose({
        color,
        gratitude: gratitude.trim() || undefined,
        anxiety: anxiety.trim() || undefined,
        hope: hope.trim() || undefined,
      });
      playComplete();
      setStep("success");
    } catch {
      setError("提交失败，请重试");
      setSubmitting(false);
    }
  }

  if (step === "color") {
    return (
      <main className="relative min-h-screen flex items-center justify-center p-4 z-10 pt-16">
        <div className="max-w-lg w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-rose-300">选择玫瑰的颜色</h2>
            <p className="text-slate-400">每种颜色代表不同的心情</p>
          </div>
          {/* Recommendation Card */}
          {(recLoading || rec) && (
            <div className="glass-card p-5 space-y-3">
              <p className="text-sm font-medium text-rose-300">智能推荐</p>
              {recLoading ? (
                <p className="text-sm text-slate-400 animate-pulse">分析你的种花历史...</p>
              ) : rec && (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-purple-300">花语：{rec.flower_language.title}</p>
                    <p className="text-xs text-slate-400">{rec.flower_language.content}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-300">试试：{rec.theme.title}</p>
                    <p className="text-xs text-slate-400">{rec.theme.content}</p>
                  </div>
                  <button
                    onClick={() => { playClick(); setColor(rec.color_suggestion.color); setStep("interactive"); }}
                    className="w-full text-left rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 hover:bg-rose-500/20 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-rose-300">推荐颜色：{rec.color_suggestion.color === "red" ? "红玫瑰" : rec.color_suggestion.color === "white" ? "白玫瑰" : "黄玫瑰"}</p>
                    <p className="text-xs text-slate-400">{rec.color_suggestion.reason}</p>
                  </button>
                </>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-6">
            {COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  playClick();
                  setColor(c.id);
                  setStep("interactive");
                }}
                className={`p-8 rounded-2xl glass-card border-white/10 hover:border-rose-300/50 hover:scale-105 transition-all cursor-pointer`}
              >
                <div className="text-5xl">{c.emoji}</div>
                <div className="mt-3 font-semibold text-lg text-slate-100">{c.label}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // 颜色对应的霓虹光晕
  const glowMap: Record<string, string> = {
    red:    "rgba(244,63,94,0.8)",
    white:  "rgba(226,232,240,0.7)",
    yellow: "rgba(234,179,8,0.8)",
  };

  if (step === "success") {
    const glowColor = glowMap[color] ?? "rgba(244,63,94,0.8)";
    return (
      <main className="relative min-h-screen flex items-center justify-center p-4 z-10">
        <Fireworks />
        {/* 中央光晕背景 */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${glowColor.replace("0.8","0.15")} 0%, transparent 70%)` }}
        />
        <div className="relative max-w-md w-full text-center space-y-8">
          {/* 浮动发光玫瑰 */}
          <div
            className="text-9xl animate-success-float animate-success-glow inline-block"
            style={{ "--glow-color": glowColor } as React.CSSProperties}
          >
            {colorMeta?.emoji}
          </div>
          {/* 文字渐显 */}
          <div className="space-y-3 animate-text-reveal">
            <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-300 to-purple-300">
              已种入星空花圃
            </h2>
            <p className="text-slate-400">你的情绪已经出现在花圃中，AI 正在聆听...</p>
          </div>
          {/* 玫瑰声音可视化 — 烟花落定后自动播放 */}
          <div className="flex justify-center animate-text-reveal" style={{ animationDelay: "1.2s" }}>
            <RosePlayer
              rose={{
                id: "preview",
                color,
                gratitude: gratitude.trim() || null,
                anxiety: anxiety.trim() || null,
                hope: hope.trim() || null,
                user_id: null,
                nickname: null,
                like_count: 0,
                ai_reply: null,
                created_at: new Date().toISOString(),
              }}
              autoPlay
              durationMs={12000}
              canvasSize={140}
            />
          </div>
          {/* 按钮 */}
          <div className="flex gap-3 justify-center animate-text-reveal" style={{ animationDelay: "0.3s" }}>
            <button
              onClick={() => router.push("/garden")}
              className="px-6 py-2.5 rounded-full text-sm font-medium glass-card text-slate-200 hover:border-white/30 transition-all"
            >
              查看花圃
            </button>
            <button
              className="px-6 py-2.5 rounded-full text-sm font-medium bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:-translate-y-0.5 transition-all"
              onClick={() => {
                setGratitude("");
                setAnxiety("");
                setHope("");
                setStep("color");
              }}
            >
              再种一朵
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 z-10 pt-16">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-rose-300">
            {colorMeta?.emoji} 种下你的玫瑰
          </h2>
          <p className="text-slate-400">点击玫瑰上的光点，分享你的故事</p>
        </div>

        {/* Interactive Rose */}
        <div className="relative flex items-center justify-center py-8">
          <div className="relative w-64 h-64">
            {/* Center rose */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-8xl">{colorMeta?.emoji}</span>
            </div>

            {/* Gratitude hotspot - top */}
            <button
              onClick={() => { playClick(); setActiveField("gratitude"); }}
              className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isFieldFilled("gratitude")
                  ? "bg-rose-500/40 shadow-lg shadow-rose-500/30 border border-rose-400/50"
                  : "bg-rose-500/20 animate-pulse shadow-md shadow-rose-500/20 border border-rose-400/30"
              } hover:scale-110 cursor-pointer`}
            >
              <span className="text-2xl">🌹</span>
            </button>

            {/* Anxiety hotspot - bottom left */}
            <button
              onClick={() => { playClick(); setActiveField("anxiety"); }}
              className={`absolute bottom-4 left-0 w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isFieldFilled("anxiety")
                  ? "bg-amber-500/40 shadow-lg shadow-amber-500/30 border border-amber-400/50"
                  : "bg-amber-500/20 animate-pulse shadow-md shadow-amber-500/20 border border-amber-400/30"
              } hover:scale-110 cursor-pointer`}
            >
              <span className="text-2xl">🌵</span>
            </button>

            {/* Hope hotspot - bottom right */}
            <button
              onClick={() => { playClick(); setActiveField("hope"); }}
              className={`absolute bottom-4 right-0 w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isFieldFilled("hope")
                  ? "bg-green-500/40 shadow-lg shadow-green-500/30 border border-green-400/50"
                  : "bg-green-500/20 animate-pulse shadow-md shadow-green-500/20 border border-green-400/30"
              } hover:scale-110 cursor-pointer`}
            >
              <span className="text-2xl">🌱</span>
            </button>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex justify-center gap-6 text-sm">
          {(["gratitude", "anxiety", "hope"] as Field[]).map((field) => (
            <div key={field} className={`flex items-center gap-1 ${isFieldFilled(field) ? FIELD_CONFIG[field].color : "text-slate-300"}`}>
              <span>{FIELD_CONFIG[field].icon}</span>
              <span>{isFieldFilled(field) ? "已填写" : FIELD_CONFIG[field].hint}</span>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        {/* Submit button */}
        <div className="flex justify-center">
          <Button
            className="bg-rose-500 hover:bg-rose-600 px-8 py-6 text-lg rounded-full shadow-lg disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting || !hasContent}
          >
            {submitting ? "种下中..." : "种下玫瑰吧"}
          </Button>
        </div>

        {/* Back button */}
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => setStep("color")}>
            换颜色
          </Button>
        </div>
      </div>

      {/* Dialog overlay */}
      {activeField && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
          onClick={() => setActiveField(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{FIELD_CONFIG[activeField].icon}</span>
              <h3 className={`text-xl font-bold ${FIELD_CONFIG[activeField].color}`}>
                {FIELD_CONFIG[activeField].label}
              </h3>
            </div>
            <p className="text-sm text-gray-600">{FIELD_CONFIG[activeField].hint}</p>
            <textarea
              className="w-full rounded-lg border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 px-4 py-3 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
              placeholder={FIELD_CONFIG[activeField].placeholder}
              value={getFieldValue(activeField)}
              onChange={(e) => setFieldValue(activeField, e.target.value)}
              maxLength={500}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {getFieldValue(activeField).length}/500
              </p>
              <Button
                className="bg-rose-500 hover:bg-rose-600 rounded-full px-6"
                onClick={() => setActiveField(null)}
              >
                确定
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

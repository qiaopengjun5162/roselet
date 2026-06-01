"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createRose, getToken, getMyRoses } from "@/lib/api";
import { playClick, playPlant, playComplete } from "@/lib/sound";
import { getRecommendation, type Recommendation } from "@/lib/recommend";

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
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 to-white p-4">
        <div className="max-w-lg w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-rose-800">选择玫瑰的颜色</h2>
            <p className="text-muted-foreground">每种颜色代表不同的心情</p>
          </div>
          {/* Recommendation Card */}
          {(recLoading || rec) && (
            <div className="rounded-2xl border border-rose-200 bg-white/80 p-5 space-y-3 shadow-sm">
              <p className="text-sm font-medium text-rose-700">智能推荐</p>
              {recLoading ? (
                <p className="text-sm text-muted-foreground animate-pulse">分析你的种花历史...</p>
              ) : rec && (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-purple-700">花语：{rec.flower_language.title}</p>
                    <p className="text-xs text-muted-foreground">{rec.flower_language.content}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-700">试试：{rec.theme.title}</p>
                    <p className="text-xs text-muted-foreground">{rec.theme.content}</p>
                  </div>
                  <button
                    onClick={() => { playClick(); setColor(rec.color_suggestion.color); setStep("interactive"); }}
                    className="w-full text-left rounded-lg border border-rose-200 p-3 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <p className="text-sm font-medium text-rose-700">推荐颜色：{rec.color_suggestion.color === "red" ? "红玫瑰" : rec.color_suggestion.color === "white" ? "白玫瑰" : "黄玫瑰"}</p>
                    <p className="text-xs text-muted-foreground">{rec.color_suggestion.reason}</p>
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
                className={`p-8 rounded-2xl bg-gradient-to-b ${c.gradient} border-2 border-transparent hover:border-rose-300 hover:scale-105 transition-all cursor-pointer shadow-sm hover:shadow-md`}
              >
                <div className="text-5xl">{c.emoji}</div>
                <div className="mt-3 font-medium text-lg">{c.label}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (step === "success") {
    return (
      <main className={`min-h-screen flex items-center justify-center bg-gradient-to-b ${colorMeta?.gradient ?? "from-rose-50 to-white"} p-4`}>
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-8xl animate-bounce">{colorMeta?.emoji}</div>
          <h2 className="text-2xl font-bold text-rose-800">谢谢你在社区种下的玫瑰</h2>
          <p className="text-muted-foreground">你的分享已经出现在花圃中了</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push("/garden")}>
              查看花圃
            </Button>
            <Button
              className="bg-rose-500 hover:bg-rose-600"
              onClick={() => {
                setGratitude("");
                setAnxiety("");
                setHope("");
                setStep("color");
              }}
            >
              再种一朵
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen flex items-center justify-center bg-gradient-to-b ${colorMeta?.gradient ?? "from-rose-50 to-white"} p-4`}>
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-rose-800">
            {colorMeta?.emoji} 种下你的玫瑰
          </h2>
          <p className="text-muted-foreground">点击玫瑰上的光点，分享你的故事</p>
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
                  ? "bg-rose-200 shadow-lg shadow-rose-300"
                  : "bg-rose-100 animate-pulse shadow-md shadow-rose-200"
              } hover:scale-110 cursor-pointer`}
            >
              <span className="text-2xl">🌹</span>
            </button>

            {/* Anxiety hotspot - bottom left */}
            <button
              onClick={() => { playClick(); setActiveField("anxiety"); }}
              className={`absolute bottom-4 left-0 w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isFieldFilled("anxiety")
                  ? "bg-amber-200 shadow-lg shadow-amber-300"
                  : "bg-amber-100 animate-pulse shadow-md shadow-amber-200"
              } hover:scale-110 cursor-pointer`}
            >
              <span className="text-2xl">🌵</span>
            </button>

            {/* Hope hotspot - bottom right */}
            <button
              onClick={() => { playClick(); setActiveField("hope"); }}
              className={`absolute bottom-4 right-0 w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isFieldFilled("hope")
                  ? "bg-green-200 shadow-lg shadow-green-300"
                  : "bg-green-100 animate-pulse shadow-md shadow-green-200"
              } hover:scale-110 cursor-pointer`}
            >
              <span className="text-2xl">🌱</span>
            </button>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex justify-center gap-6 text-sm">
          {(["gratitude", "anxiety", "hope"] as Field[]).map((field) => (
            <div key={field} className={`flex items-center gap-1 ${isFieldFilled(field) ? FIELD_CONFIG[field].color : "text-muted-foreground"}`}>
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
            <p className="text-sm text-muted-foreground">{FIELD_CONFIG[activeField].hint}</p>
            <textarea
              className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
              placeholder={FIELD_CONFIG[activeField].placeholder}
              value={getFieldValue(activeField)}
              onChange={(e) => setFieldValue(activeField, e.target.value)}
              maxLength={500}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
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

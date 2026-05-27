"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createRose } from "@/lib/api";

const COLORS = [
  { id: "red", label: "红玫瑰", emoji: "🌹", bg: "bg-red-100", border: "border-red-300" },
  { id: "white", label: "白玫瑰", emoji: "🤍", bg: "bg-gray-100", border: "border-gray-300" },
  { id: "yellow", label: "黄玫瑰", emoji: "💛", bg: "bg-yellow-100", border: "border-yellow-300" },
] as const;

export default function PlantPage() {
  const router = useRouter();
  const [step, setStep] = useState<"color" | "form">("color");
  const [color, setColor] = useState<string>("");
  const [gratitude, setGratitude] = useState("");
  const [anxiety, setAnxiety] = useState("");
  const [hope, setHope] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await createRose({ color, gratitude, anxiety, hope });
      router.push("/garden");
    } catch {
      alert("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "color") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 to-white p-4">
        <div className="max-w-lg w-full space-y-6">
          <h2 className="text-2xl font-bold text-center text-rose-800">
            选择玫瑰的颜色
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setColor(c.id);
                  setStep("form");
                }}
                className={`p-6 rounded-xl border-2 ${c.border} ${c.bg} hover:scale-105 transition-transform cursor-pointer`}
              >
                <div className="text-4xl">{c.emoji}</div>
                <div className="mt-2 font-medium">{c.label}</div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-rose-50 to-white p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="text-center text-rose-800">
            {COLORS.find((c) => c.id === color)?.emoji} 种下你的玫瑰
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-rose-700">
              玫瑰 — 一件让你感恩的事
            </label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
              placeholder="这周让你感到幸福或感恩的事情是..."
              value={gratitude}
              onChange={(e) => setGratitude(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-amber-700">
              尖刺 — 让你焦虑的事
            </label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
              placeholder="现在有什么让你感到焦虑或需要帮助的..."
              value={anxiety}
              onChange={(e) => setAnxiety(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-green-700">
              花苞 — 你的期待
            </label>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
              placeholder="你现在期待的事情或新灵感..."
              value={hope}
              onChange={(e) => setHope(e.target.value)}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setStep("color")}>
              换颜色
            </Button>
            <Button
              className="bg-rose-500 hover:bg-rose-600"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "种下中..." : "种下玫瑰吧"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

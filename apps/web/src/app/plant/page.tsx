"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createRose, getToken, getMyRoses, register, setToken, setRefreshToken, setUser } from "@/lib/api";
import { registerErrorMessage } from "@/lib/auth-errors";
import { playClick, playPlant, playComplete } from "@/lib/sound";
import { getRecommendation, validatePlantInput, type Recommendation } from "@/lib/recommend";
import { Fireworks } from "@/components/fireworks";
import { RosePlayer } from "@/components/rose-player";
import { MemberOnly } from "@/components/member-only";
import InteractiveRose from "@/components/interactive-rose";
import { PlantingGarden } from "@/components/planting-garden";
import {
  COLOR_FALLBACK,
  PLANTED_CONFIRMATION,
  PLANTED_CONFIRMATION_PRIVATE,
  PLANTED_TITLE,
  colorLabelFallback,
} from "@roselet/core";

// 颜色元数据统一来自 @roselet/core（Rust WASM `color_options` 为权威）。
// 原先这里另存了一份 id/label/emoji，还带着从未被使用的 gradient/accent。
// crates/recommend/src/contract.rs 会守卫本文件不再复制颜色文案。
const COLORS = COLOR_FALLBACK;

type Field = "gratitude" | "anxiety" | "hope";

const FIELD_CONFIG: Record<Field, { label: string; placeholder: string; hint: string; rule: string; color: string; icon: string }> = {
  gratitude: {
    label: "玫瑰",
    placeholder: "这周让你感到幸福或感恩的事情是...",
    hint: "一件让你感恩的事",
    rule: "在社区的这一周，一件让你感到幸福或感恩的事情是什么？",
    color: "text-rose-600",
    icon: "🌹",
  },
  anxiety: {
    label: "尖刺",
    placeholder: "现在有什么让你感到焦虑或需要帮助的...",
    hint: "有什么让你焦虑",
    rule: "现在有什么让你感到焦虑或者需要帮助的事情吗？",
    color: "text-amber-600",
    icon: "🌵",
  },
  hope: {
    label: "花苞",
    placeholder: "你现在期待的事情或新灵感...",
    hint: "你现在有什么期待",
    rule: "你现在有什么期待的事情吗？这周有什么新灵感想要实现呢？",
    color: "text-green-600",
    icon: "🌱",
  },
};

export default function PlantPage() {
  const router = useRouter();
  const [step, setStep] = useState<"color" | "interactive" | "success">("color");
  const [color, setColor] = useState<string>("");
  // 默认就落在「玫瑰」这一栏：过去输入框藏在光点弹窗后面，不点光点就
  // 永远看不到输入框，没耐心的人会以为这里没法写。现在一进页面就有输入框，
  // 光点只负责「换一栏写」（三栏内容各自保留）。
  const [activeField, setActiveField] = useState<Field>("gratitude");
  // 初心第二界面：点光点弹出聚焦提示卡，淡字显示规则，开始打字淡字消失。
  // 输入框本身仍常驻页面（照顾小白），提示卡只是叠加的一层仪式感。
  const [hintField, setHintField] = useState<Field | null>(null);
  const [gratitude, setGratitude] = useState("");
  const [anxiety, setAnxiety] = useState("");
  const [hope, setHope] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [recipientNickname, setRecipientNickname] = useState("");
  // 未登录不再被踢去登录页：先让人把话写完，点「种下」时才要一个名字。
  const [needsNickname, setNeedsNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [passphraseDraft, setPassphraseDraft] = useState("");
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const hasContent = gratitude.trim() || anxiety.trim() || hope.trim();
  const isGift = recipientNickname.trim().length > 0;

  function togglePrivate() {
    const next = !isPrivate;
    setIsPrivate(next);
    if (next) {
      // 私密玫瑰只给自己看，不能同时送人
      setRecipientNickname("");
    }
  }

  function handleRecipientChange(value: string) {
    setRecipientNickname(value);
    if (value.trim().length > 0) {
      // 送礼需要对方能看到，因此必须是公开玫瑰
      setIsPrivate(false);
    }
  }

  // 不再在进页面时就跳登录页。过去这一步把「写一句，种一朵玫瑰」变成了
  // 「先注册」，没耐心的人还没写就走了。现在只在提交时补一个昵称。
  // 推荐仍只对已登录用户加载（getMyRoses 需要 token）。

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

  // 点光点 = 切换要写的栏目 + 弹出对应的淡字提示卡（初心的仪式感）。
  function selectField(field: Field) {
    playClick();
    setActiveField(field);
    setHintField(field);
  }

  async function plantRose() {
    setSubmitting(true);
    setError("");
    playPlant();

    try {
      const result = await validatePlantInput({
        color,
        gratitude: gratitude.trim() || undefined,
        anxiety: anxiety.trim() || undefined,
        hope: hope.trim() || undefined,
      });

      if (result && !result.valid) {
        setError(result.error || "校验失败");
        setSubmitting(false);
        return;
      }

      const cleaned = result?.cleaned;
      const payload: Parameters<typeof createRose>[0] = {
        color: cleaned?.color || color,
        gratitude: cleaned ? (cleaned.gratitude || undefined) : (gratitude.trim() || undefined),
        anxiety: cleaned ? (cleaned.anxiety || undefined) : (anxiety.trim() || undefined),
        hope: cleaned ? (cleaned.hope || undefined) : (hope.trim() || undefined),
        is_private: isPrivate || undefined,
        recipient_nickname: recipientNickname.trim() || undefined,
      };
      await createRose(payload);
      playComplete();
      setStep("success");
    } catch {
      setError("提交失败，请重试");
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!hasContent) return;
    if (!getToken()) {
      // 内容已留在 state 里，取完名字会接着种，不会丢。
      setAuthError("");
      setNeedsNickname(true);
      return;
    }
    await plantRose();
  }

  async function handleRegisterAndPlant(e: React.FormEvent) {
    e.preventDefault();
    const nickname = nicknameDraft.trim();
    if (!nickname || authSubmitting) return;

    setAuthSubmitting(true);
    setAuthError("");
    try {
      const res = await register(nickname, passphraseDraft || undefined);
      setToken(res.access_token);
      setRefreshToken(res.refresh_token);
      setUser(res.user);
      window.dispatchEvent(new Event("auth-change"));
      setNeedsNickname(false);
      await plantRose();
    } catch (err) {
      setAuthError(registerErrorMessage(err));
      setAuthSubmitting(false);
    }
  }

  if (step === "color") {
    return (
      <main className="relative h-full flex items-center justify-center p-4 z-10 pt-16">
        <div className="max-w-lg w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-rose-300">选择玫瑰的颜色</h2>
            <p className="text-slate-400">每种颜色代表不同的心情</p>
            {/* Web3 入口：普通界面零痕迹，只有切换到会员版才出现 */}
            <MemberOnly>
              <Link
                href="/private-vault"
                className="inline-flex items-center gap-1.5 text-sm text-emerald-300 hover:text-emerald-200"
              >
                <LockKeyhole className="size-4" aria-hidden="true" />
                使用 Aleo 私密 Vault
              </Link>
            </MemberOnly>
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
                    <p className="text-sm font-medium text-rose-300">推荐颜色：{colorLabelFallback(rec.color_suggestion.color)}</p>
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
      <main className="relative h-full flex items-center justify-center p-4 z-10">
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
              {PLANTED_TITLE}
            </h2>
            <p className="text-slate-400">
              {isPrivate ? PLANTED_CONFIRMATION_PRIVATE : PLANTED_CONFIRMATION}
            </p>
          </div>
          {/* 初心第三界面：玫瑰被种进花圃，各色玫瑰都在 + 感谢文案 */}
          <div className="flex justify-center pt-2">
            <PlantingGarden color={color} />
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
                is_private: isPrivate,
                created_at: new Date().toISOString(),
                recipient_nickname: recipientNickname.trim() || null,
                is_gift: recipientNickname.trim().length > 0,
              }}
              autoPlay
              durationMs={12000}
              canvasSize={140}
            />
          </div>
          {/* 按钮 */}
          <div className="flex gap-3 justify-center animate-text-reveal" style={{ animationDelay: "0.3s" }}>
            <button
              onClick={() => router.push(isPrivate ? "/my" : "/garden")}
              className="px-6 py-2.5 rounded-full text-sm font-medium glass-card text-slate-200 hover:border-white/30 transition-all"
            >
              {isPrivate ? "查看我的花圃" : "查看花圃"}
            </button>
            <button
              className="px-6 py-2.5 rounded-full text-sm font-medium bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 hover:-translate-y-0.5 transition-all"
              onClick={() => {
                setGratitude("");
                setAnxiety("");
                setHope("");
                setRecipientNickname("");
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
    <main className="relative min-h-full flex flex-col items-center p-4 pt-8 z-10">
      <div className="max-w-lg w-full space-y-6 my-auto">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-rose-300">
            {colorMeta?.emoji} 种下你的玫瑰
          </h2>
          <p className="text-slate-400">写一句就够了，想起别的再点旁边两个光点</p>
        </div>

        {/* 初心第二界面：可拖拽的 2D 玫瑰，花瓣/花苞/尖刺上各一个闪光点 */}
        <div className="relative flex items-center justify-center py-2">
          <InteractiveRose
            color={color}
            activeField={activeField}
            filled={{
              gratitude: isFieldFilled("gratitude"),
              anxiety: isFieldFilled("anxiety"),
              hope: isFieldFilled("hope"),
            }}
            onFieldSelect={selectField}
          />
        </div>

        {/* 输入框直接摆在页面上：不需要先点光点才能看见 */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-lg" aria-hidden="true">{FIELD_CONFIG[activeField].icon}</span>
            <span className="font-medium text-slate-200">{FIELD_CONFIG[activeField].label}</span>
            <span className="text-slate-500">· {FIELD_CONFIG[activeField].hint}</span>
          </div>
          <textarea
            aria-label={FIELD_CONFIG[activeField].label}
            className="w-full rounded-xl border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 px-4 py-3 text-sm min-h-[96px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
            placeholder={FIELD_CONFIG[activeField].placeholder}
            value={getFieldValue(activeField)}
            onChange={(e) => setFieldValue(activeField, e.target.value)}
            maxLength={500}
          />
          <p className="text-right text-xs text-slate-500">
            {getFieldValue(activeField).length}/500
          </p>
        </div>

        {/* Status indicators：带文字的切换按钮，比三个光点更好认 */}
        <div className="flex justify-center gap-2 text-xs">
          {(["gratitude", "anxiety", "hope"] as Field[]).map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => setActiveField(field)}
              aria-pressed={activeField === field}
              className={`flex items-center gap-1 rounded-full px-3 py-1 border transition-colors ${
                activeField === field
                  ? "border-white/25 bg-white/10 text-slate-200"
                  : isFieldFilled(field)
                    ? `${FIELD_CONFIG[field].color} border-white/10`
                    : "text-slate-400 border-white/5"
              }`}
            >
              <span>{FIELD_CONFIG[field].icon}</span>
              <span>{isFieldFilled(field) ? "已写" : FIELD_CONFIG[field].label}</span>
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        {/* Private toggle + Recipient */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={togglePrivate}
            disabled={isGift}
            title={isGift ? "送礼需要公开，对方才能看到" : undefined}
            className={`px-4 py-1.5 rounded-full text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isPrivate
                ? "bg-purple-500/20 border border-purple-500/40 text-purple-300"
                : "bg-white/5 border border-white/10 text-slate-500"
            }`}
          >
            {isPrivate ? "🔒 仅自己可见" : "🌐 公开分享"}
          </button>
          {isPrivate && (
            <p className="text-[10px] text-purple-300/70">私密玫瑰不会送给任何人</p>
          )}

          {/* Recipient nickname input */}
          <div className="w-full max-w-xs">
            <input
              type="text"
              value={recipientNickname}
              onChange={(e) => handleRecipientChange(e.target.value)}
              placeholder="送给谁？（留空=为自己种花；送礼会公开）"
              maxLength={50}
              disabled={isPrivate}
              className="w-full rounded-full border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 px-4 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Submit button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            className="bg-rose-500 hover:bg-rose-600 px-8 py-6 text-lg rounded-full shadow-lg disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting || !hasContent}
          >
            {submitting ? "种下中..." : isGift ? "送出这朵玫瑰吧" : "种下玫瑰吧"}
          </Button>
          {!hasContent && (
            <p className="text-xs text-slate-500">写一个字，按钮就会亮起来</p>
          )}
        </div>

        {/* Back button */}
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => setStep("color")}>
            换颜色
          </Button>
        </div>
      </div>

      {/* 初心第二界面：点光点弹出的聚焦提示卡。
          淡字显示这一栏的规则原文，一开始打字淡字就消失。
          主输入框仍在页面上（融合方案），关闭这张卡照样能写。 */}
      {hintField && (
        <div
          className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 z-40"
          onClick={() => setHintField(null)}
        >
          <div
            className="glass-card rounded-2xl p-6 max-w-md w-full space-y-4 border border-white/15 bg-[#0f081e]/95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">{FIELD_CONFIG[hintField].icon}</span>
                <h3 className="font-semibold text-slate-100">{FIELD_CONFIG[hintField].label}</h3>
              </div>
              <button
                type="button"
                onClick={() => setHintField(null)}
                aria-label="关闭提示"
                className="text-slate-400 hover:text-slate-200 text-xl leading-none px-2"
              >
                ×
              </button>
            </div>
            <div className="relative">
              {/* 淡字规则：这一栏还是空的时候显示，一开始打字就淡出消失 */}
              <p
                className={`pointer-events-none absolute left-0 top-0 right-0 text-base leading-relaxed text-slate-500 transition-opacity duration-300 ${
                  getFieldValue(hintField).trim() ? "opacity-0" : "opacity-100"
                }`}
              >
                {FIELD_CONFIG[hintField].rule}
              </p>
              <textarea
                aria-label="在这句话里写下你的心事"
                autoFocus
                value={getFieldValue(hintField)}
                onChange={(e) => setFieldValue(hintField, e.target.value)}
                maxLength={500}
                className="w-full rounded-xl border border-white/10 bg-white/5 text-slate-100 placeholder:text-transparent px-4 py-3 pt-7 text-base min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setHintField(null)}
                className="px-5 py-2 rounded-full text-sm font-medium bg-rose-500 hover:bg-rose-600 text-white"
              >
                写好了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提交时才要名字：内容已经写好了，这一步只是给玫瑰一个主人 */}
      {needsNickname && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => { if (!authSubmitting) setNeedsNickname(false); }}
        >
          <form
            onSubmit={handleRegisterAndPlant}
            className="glass-card rounded-2xl p-6 max-w-md w-full space-y-4 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-200">先给自己取个名字</h3>
              <p className="text-sm text-slate-400">
                玫瑰要有个主人。不用手机号，也不用邮箱，写完这朵就是你的。
              </p>
            </div>
            <input
              type="text"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              placeholder="你想叫什么名字？"
              maxLength={50}
              autoFocus
              className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <input
              type="password"
              value={passphraseDraft}
              onChange={(e) => setPassphraseDraft(e.target.value)}
              placeholder="密码（可选，设了更安全）"
              maxLength={100}
              className="w-full rounded-lg border border-white/10 bg-white/5 text-slate-200 placeholder:text-slate-500 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            {authError && <p className="text-sm text-red-500">{authError}</p>}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setNeedsNickname(false)}
                disabled={authSubmitting}
                className="text-sm text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
              >
                返回修改
              </button>
              <Button
                type="submit"
                disabled={!nicknameDraft.trim() || authSubmitting}
                className="bg-rose-500 hover:bg-rose-600 rounded-full px-6"
              >
                {authSubmitting ? "准备中..." : "种下这朵玫瑰"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

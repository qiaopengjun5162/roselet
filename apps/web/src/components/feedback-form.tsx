"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { validateFeedback } from "@/lib/wasm";

interface FeedbackFormProps {
  onSubmitSuccess?: () => void;
}

export function FeedbackForm({ onSubmitSuccess }: FeedbackFormProps) {
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastKeystroke, setLastKeystroke] = useState(0);
  const [isValidating, setIsValidating] = useState(false);

  // 使用 WASM 进行实时验证
  const validateInput = useCallback(async () => {
    if (feedback.trim().length > 0) {
      const validation = await validateFeedback(feedback.trim());
      if (!validation.valid && validation.error) {
        setError(validation.error);
        setIsValidating(true);
        setTimeout(() => setIsValidating(false), 2000);
      }
    }
  }, [feedback]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      validateInput();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [feedback, validateInput]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFeedback(value);
    setLastKeystroke(Date.now());
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !submitting) {
        e.preventDefault();
        const form = document.getElementById('feedback-form');
        if (form) {
          (form as HTMLFormElement).requestSubmit();
        }
      }

      // Escape to clear error
      if (e.key === 'Escape' && error) {
        setError('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [submitting, error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Announce form submission to screen readers
    const announcement = document.getElementById('form-announcement');
    if (announcement) {
      announcement.textContent = '正在提交反馈...';
    }

    // 使用 WASM 验证
    const validation = await validateFeedback(feedback.trim());
    if (!validation.valid) {
      setError(validation.error || "请输入反馈内容");
      const errorAnnouncement = document.getElementById('error-announcement');
      if (errorAnnouncement) {
        errorAnnouncement.textContent = `错误：${validation.error || '请输入反馈内容'}`;
      }
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(typeof window !== "undefined" && localStorage.getItem("token")
            ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
            : {}),
        },
        body: JSON.stringify({ content: feedback.trim() }),
      });

      if (result.ok) {
        setSubmitted(true);
        setFeedback("");
        onSubmitSuccess?.();

        // Announce success to screen readers
        if (announcement) {
          announcement.textContent = '反馈提交成功！';
        }

        setTimeout(() => setSubmitted(false), 3000);
      } else {
        const errorData = await result.text();
        const errorMessage = errorData || "提交失败";
        setError(errorMessage);

        // Announce error to screen readers
        if (announcement) {
          announcement.textContent = `错误：${errorMessage}`;
        }
      }
    } catch (err) {
      setError("提交失败，请稍后重试");
      if (announcement) {
        announcement.textContent = '错误：提交失败，请稍后重试';
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-center py-12 relative overflow-hidden"
      >
        {/* Screen reader announcement */}
        <div id="form-announcement" className="sr-only"></div>

        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-pink-500/5"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-black/20"></div>

        {/* 成功动画 */}
        <div className="relative z-10 animate-in fade-in duration-500">
          {/* 成功动画图标 */}
          <div className="relative inline-flex items-center justify-center w-20 h-20 mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-ping opacity-20"></div>
            <div className="relative w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-green-500/30 animate-in zoom-in duration-300">
              <svg className="w-10 h-10 text-green-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h3 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-3 animate-in slide-in-from-bottom duration-500 delay-100">
            提交成功！
          </h3>
          <p className="text-slate-400 text-lg leading-relaxed animate-in slide-in-from-bottom duration-500 delay-200">
            感谢您的宝贵反馈，您的意见将帮助我们持续改进产品体验。
          </p>

          {/* 装饰线条 */}
          <div className="mt-6 flex justify-center animate-in fade-in duration-500 delay-300">
            <div className="h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent w-32"></div>
          </div>

          {/* 可访问的关闭按钮提示 */}
          <div className="mt-6 animate-in fade-in duration-500 delay-400">
            <p className="text-xs text-slate-500" aria-hidden="true">
              3秒后自动关闭
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      id="feedback-form"
      onSubmit={handleSubmit}
      role="form"
      aria-labelledby="form-title"
      className="space-y-6 relative"
      noValidate
    >
      {/* Screen reader announcements */}
      <div
        id="error-announcement"
        className="sr-only"
        aria-live="assertive"
        aria-atomic="true"
      ></div>
      <div
        id="typing-indicator"
        className="sr-only"
        aria-live="polite"
      ></div>

      {/* 背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-pink-500/5 rounded-xl -z-10"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-black/10 rounded-xl -z-10"></div>

      {/* 标题区域 */}
      <div className="relative mb-8">
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-4 -right-4 w-40 h-40 bg-pink-500/10 rounded-full blur-2xl"></div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2
              id="form-title"
              className="text-xl font-bold text-slate-100"
            >
              分享您的想法
            </h2>
          </div>
          <p className="text-slate-400 text-sm ml-13">
            您的反馈是我们前进的动力
          </p>
        </div>
      </div>

      {/* 输入区域 */}
      <div className="relative">
        <label
          htmlFor="feedback"
          className="text-sm font-medium text-slate-300 mb-3 block"
          aria-required="true"
        >
          您的反馈
        </label>
        <div className="relative">
          {/* 装饰边框 */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-rose-500/20 to-pink-500/20 rounded-xl blur-sm opacity-0 -z-10 transition-opacity duration-300 pointer-events-none"
            id="feedback-glow"
          ></div>

          <Textarea
            id="feedback"
            name="feedback"
            placeholder="请描述您的建议、遇到的问题或其他想法..."
            value={feedback}
            onChange={handleInputChange}
            onFocus={(e) => {
              const glow = document.getElementById('feedback-glow');
              if (glow) glow.classList.add('opacity-100');
            }}
            onBlur={(e) => {
              const glow = document.getElementById('feedback-glow');
              if (glow) glow.classList.remove('opacity-100');
            }}
            onKeyDown={(e) => {
              // Typing indicator for screen readers
              if (e.key.length === 1) {
                const indicator = document.getElementById('typing-indicator');
                if (indicator) {
                  indicator.textContent = '正在输入...';
                  setTimeout(() => {
                    if (indicator.textContent === '正在输入...') {
                      indicator.textContent = '';
                    }
                  }, 1000);
                }
              }
            }}
            aria-describedby="char-count validation-hint"
            required
            minLength={5}
            maxLength={500}
            className="min-h-[140px] bg-slate-800/60 border border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-rose-400 focus:ring-rose-400/20 transition-all duration-200 backdrop-blur-sm will-change-transform"
          />
        </div>

        {/* 字符计数器和提示 */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                feedback.length > 0 && feedback.length < 5
                  ? 'bg-rose-500 animate-pulse'
                  : feedback.length >= 5
                    ? 'bg-green-500'
                    : 'bg-slate-600'
              }`}
              aria-hidden="true"
            ></div>
            <p
              id="validation-hint"
              className="text-xs text-slate-500 font-light"
            >
              {feedback.length > 0 && feedback.length < 5
                ? '至少需要 5 个字符'
                : '最多 500 个字符'
              }
            </p>
          </div>
          <span
            className={`text-xs font-mono font-light tracking-wider transition-colors duration-300 ${
              feedback.length > 450
                ? 'text-red-400 animate-pulse'
                : feedback.length > 400
                  ? 'text-amber-400'
                  : feedback.length > 0
                    ? 'text-rose-400'
                    : 'text-slate-500'
            }`}
            aria-live="polite"
          >
            {feedback.length}/500
          </span>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div
          role="alert"
          className="relative overflow-hidden rounded-lg border border-red-500/20 bg-red-500/5 p-4 animate-in slide-in-from-top duration-300"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 via-transparent to-red-500/10 opacity-30"></div>
          <div className="relative flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-red-400 font-medium" aria-live="assertive">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* 验证中提示 */}
      {isValidating && feedback.length > 0 && feedback.length < 5 && (
        <div className="flex items-center gap-2 text-xs text-amber-400 animate-pulse">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>输入字符过少</span>
        </div>
      )}

      {/* 提交按钮 */}
      <Button
        type="submit"
        disabled={submitting || !feedback.trim()}
        aria-describedby={submitting ? "submitting" : undefined}
        className="w-full relative overflow-hidden group"
      >
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-gradient-to-r from-rose-600 to-pink-600 opacity-100 group-hover:opacity-90 transition-opacity duration-200"></div>

        {/* 动态光泽效果 */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>

        {/* 按钮内容 */}
        <span
          className="relative z-10 flex items-center justify-center gap-3"
          role="status"
          aria-live="polite"
        >
          {submitting ? (
            <>
              <div className="relative">
                <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <span className="font-medium" id="submitting">发送中...</span>
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <span className="font-medium">提交反馈</span>
            </>
          )}
        </span>
      </Button>

      {/* 键盘快捷键提示 */}
      <div className="text-center text-xs text-slate-500 mt-4" aria-hidden="true">
        按 Ctrl+Enter 快速提交
      </div>
    </form>
  );
}
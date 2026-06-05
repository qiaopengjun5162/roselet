"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackFormProps {
  onSubmitSuccess?: () => void;
}

export function FeedbackForm({ onSubmitSuccess }: FeedbackFormProps) {
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) {
      setError("请输入反馈内容");
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
        setTimeout(() => setSubmitted(false), 3000);
      } else {
        const errorData = await result.text();
        setError(errorData || "提交失败");
      }
    } catch (err) {
      setError("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl mb-4">🎉</div>
        <p className="text-slate-300">感谢您的反馈！我们会认真考虑您的建议。</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Textarea
          placeholder="请输入您的反馈、建议或遇到的问题..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="min-h-[120px] bg-slate-800/50 border-slate-600 text-slate-100"
          maxLength={500}
        />
        <p className="text-right text-sm text-slate-500 mt-1">
          {feedback.length}/500
        </p>
      </div>
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
      <Button
        type="submit"
        disabled={submitting || !feedback.trim()}
        className="bg-rose-600 hover:bg-rose-700"
      >
        {submitting ? "提交中..." : "提交反馈"}
      </Button>
    </form>
  );
}
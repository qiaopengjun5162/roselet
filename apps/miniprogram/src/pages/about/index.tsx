import { View, Text, Textarea } from "@tarojs/components";
import { useState } from "react";
import Taro from "@tarojs/taro";
import { NavBar, TOTAL_HEADER_HEIGHT } from "@/components/NavBar";
import { submitFeedback } from "@/utils/api";
import { validateFeedback } from "@/utils/wasm";
import styles from "./index.module.css";

export default function About() {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    // Rust WASM 反馈验证 (与 Web feedback-form.tsx 同源)
    const v = validateFeedback(feedback);
    if (v && !v.valid) { setError(v.error || "格式错误"); return; }
    setSubmitting(true); setError("");
    const ok = await submitFeedback(feedback.trim());
    if (ok) { setSubmitted(true); setFeedback(""); setTimeout(() => setSubmitted(false), 2500); }
    else { setError("提交失败，请重试"); }
    setSubmitting(false);
  };

  return (
    <View className={styles.page}>
      <NavBar title="留言" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 16}px` }}>

        {/* 左: 项目介绍 — 对应 Web StarBottle */}
        <View className={styles.bottle}>
          <Text className={styles.bottleTitle}>玫瑰源</Text>
          <Text className={styles.bottleText}>
            一个社区情绪花园。在这里种下一朵玫瑰，用颜色和文字承载感恩、期待或焦虑。AI 会为它生成专属回应，Rust 驱动的声音引擎将情感转化为波形。
          </Text>
        </View>

        {/* 中: 反馈 — 对应 Web FeedbackBottle */}
        <View className={styles.bottleHighlight}>
          {submitted ? (
            <View className={styles.successMsg}>
              <Text className={styles.successEmoji}>✨</Text>
              <Text className={styles.successText}>感谢反馈！</Text>
            </View>
          ) : (
            <View>
              <Text className={styles.bottleTitle}>留下声音</Text>
              <Textarea
                className={styles.textarea}
                value={feedback}
                onInput={(e: any) => setFeedback(e.detail.value)}
                placeholder="分享你的想法、建议或遇到的 bug..."
                maxlength={500}
                autoHeight
              />
              <Text className={styles.charCount}>{feedback.length}/500</Text>
              {error ? <Text className={styles.errorText}>{error}</Text> : null}
              <View
                className={styles.submitBtn}
                onClick={submitting ? undefined : handleSubmit}
              >
                <Text className={styles.submitBtnText}>
                  {submitting ? "提交中..." : "投递进星空"}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* 右: 开发者 — 对应 Web StarBottle */}
        <View className={styles.bottle}>
          <Text className={styles.bottleTitle}>寻月隐君</Text>
          <Text className={styles.bottleText}>全栈开发者，在虚空里用代码种花。</Text>
          <View className={styles.highlightBox}>
            <Text className={styles.highlightText}>关注微信公众号《寻月隐君》</Text>
          </View>
          <View className={styles.devLinks}>
            <View
              className={styles.devLink}
              onClick={() => { Taro.setClipboardData({ data: "https://github.com/qiaopengjun5162" }); Taro.showToast({ title: "GitHub 已复制", icon: "none" }); }}
            >
              <Text>GitHub</Text>
            </View>
            <View
              className={styles.devLink}
              onClick={() => { Taro.setClipboardData({ data: "qiaopengjun5162@gmail.com" }); Taro.showToast({ title: "Email 已复制", icon: "none" }); }}
            >
              <Text>Email</Text>
            </View>
          </View>
        </View>

        {/* 版本 */}
        <Text className={styles.version}>Roselet v1.0.0 · MIT</Text>
      </View>
    </View>
  );
}

import { View, Text, Textarea } from "@tarojs/components";
import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { NavBar, TOTAL_HEADER_HEIGHT } from "@/components/NavBar";
import { getHealth, submitFeedback } from "@/api";
import { validateFeedback } from "@/utils/wasm";
import type { HealthResponse } from "@roselet/core";
import styles from "./index.module.css";

export default function About() {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [openHelp, setOpenHelp] = useState<string | null>("plant");

  useEffect(() => {
    getHealth()
      .then((res) => {
        setHealth(res);
        setHealthError(false);
      })
      .catch(() => {
        setHealth(null);
        setHealthError(true);
      });
  }, []);

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

        <View className={styles.bottle}>
          <Text className={styles.bottleTitle}>玫瑰源</Text>
          <Text className={styles.bottleText}>
            一个社区情绪花园。在这里种下一朵玫瑰，用颜色和文字承载感恩、期待或焦虑。AI 会为它生成专属回应，Rust 驱动的声音引擎将情感转化为波形。
          </Text>
          <View className={styles.statusBox}>
            <View className={styles.statusHeader}>
              <Text className={styles.statusTitle}>运行状态</Text>
              <Text className={health?.status === "ok" && health.database === "healthy" ? styles.statusDotOk : healthError ? styles.statusDotBad : styles.statusDotLoading} />
            </View>
            <Text className={styles.statusText}>
              {health ? `服务 ${health.status} · 数据库 ${health.database}` : healthError ? "暂时无法读取后端状态" : "正在读取 /health"}
            </Text>
            {health ? <Text className={styles.versionInline}>版本 {health.version}</Text> : null}
          </View>
          <View className={styles.helpList}>
            {[
              { id: "plant", title: "如何种花？", text: "登录后进入种花页，填写感恩、期待或焦虑中的任意一项，选择颜色后提交。" },
              { id: "private", title: "私密模式怎么用？", text: "打开私密开关后，玫瑰只会出现在你的个人花圃，不进入公共花圃。" },
              { id: "feedback", title: "反馈会记录身份吗？", text: "登录状态会关联用户 id，匿名状态也可以提交，内容只用于改进产品。" },
            ].map((item) => (
              <View
                key={item.id}
                className={styles.helpItem}
                onClick={() => setOpenHelp(openHelp === item.id ? null : item.id)}
              >
                <View className={styles.helpSummary}>
                  <Text className={styles.helpTitle}>{item.title}</Text>
                  <Text className={styles.helpMark}>{openHelp === item.id ? "−" : "+"}</Text>
                </View>
                {openHelp === item.id ? <Text className={styles.helpText}>{item.text}</Text> : null}
              </View>
            ))}
          </View>
        </View>

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

        <View className={styles.bottle}>
          <Text className={styles.bottleTitle}>联系方式</Text>
          <Text className={styles.bottleText}>寻月隐君，全栈开发者，在虚空里用代码种花。</Text>
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

        <Text className={styles.version}>Roselet · MIT</Text>
      </View>
    </View>
  );
}

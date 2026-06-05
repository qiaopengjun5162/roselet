import { View, Text, Button, Form, Input } from "@tarojs/components";
import { useState } from "react";
import Taro from "@tarojs/taro";
import { NavBar, TOTAL_HEADER_HEIGHT } from "@/components/NavBar";
import { getToken, getUserId } from "@/utils/storage";
import { submitFeedback } from "@/utils/api";
import { validateFeedback } from "@/utils/validate";
import styles from "./index.module.css";

export default function About() {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const validation = validateFeedback(feedback);
    if (!validation.valid) {
      setError(validation.error || "反馈内容格式不正确");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const success = await submitFeedback(feedback);
      if (success) {
        setSubmitted(true);
        setFeedback("");
        setTimeout(() => setSubmitted(false), 2000);
      } else {
        setError("提交失败，请稍后重试");
      }
    } catch (err) {
      setError("提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className={styles.page}>
      <NavBar title="关于我们" />

      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 24}px` }}>
        {/* 项目介绍 */}
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>项目简介</Text>
          <View className={styles.intro}>
            <View className={styles.cards}>
              <View className={styles.card}>
                <Text className={styles.cardEmoji}>🌹</Text>
                <View>
                  <Text className={styles.cardTitle}>玫瑰 · 感恩</Text>
                  <Text className={styles.cardDesc}>感谢身边的人和事</Text>
                </View>
              </View>
              <View className={styles.card}>
                <Text className={styles.cardEmoji}>🌸</Text>
                <View>
                  <Text className={styles.cardTitle}>花苞 · 期待</Text>
                  <Text className={styles.cardDesc}>对未来的美好期许</Text>
                </View>
              </View>
              <View className={styles.card}>
                <Text className={styles.cardEmoji}>🌵</Text>
                <View>
                  <Text className={styles.cardTitle}>尖刺 · 焦虑</Text>
                  <Text className={styles.cardDesc}>表达内心的不安与担忧</Text>
                </View>
              </View>
            </View>
            <Text className={styles.desc}>
              每一朵花都是一个情感载体，汇聚成社区的花圃，让彼此的心灵得到连接和治愈。
            </Text>
          </View>
        </View>

        {/* 技术栈 */}
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>技术栈</Text>
          <View className={styles.techStack}>
            <View className={styles.techGroup}>
              <Text className={styles.techTitle}>后端</Text>
              <View className={styles.techTags}>
                <Text className={styles.techTag}>Rust</Text>
                <Text className={styles.techTag}>Axum</Text>
                <Text className={styles.techTag}>SQLx</Text>
                <Text className={styles.techTag}>PostgreSQL</Text>
              </View>
            </View>
            <View className={styles.techGroup}>
              <Text className={styles.techTitle}>前端</Text>
              <View className={styles.techTags}>
                <Text className={styles.techTag}>Next.js</Text>
                <Text className={styles.techTag}>React</Text>
                <Text className={styles.techTag}>TypeScript</Text>
                <Text className={styles.techTag}>Tailwind</Text>
              </View>
            </View>
            <View className={styles.techGroup}>
              <Text className={styles.techTitle}>小程序</Text>
              <View className={styles.techTags}>
                <Text className={styles.techTag}>Taro 4</Text>
                <Text className={styles.techTag}>React</Text>
                <Text className={styles.techTag}>TypeScript</Text>
              </View>
            </View>
            <View className={styles.techGroup}>
              <Text className={styles.techTitle}>AI & WASM</Text>
              <View className={styles.techTags}>
                <Text className={styles.techTag}>OpenAI</Text>
                <Text className={styles.techTag}>Rust WASM</Text>
                <Text className={styles.techTag}>情绪分析</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 开发者信息 */}
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>开发者信息</Text>
          <View className={styles.devInfo}>
            <View className={styles.avatar}>Q</View>
            <View className={styles.devDetails}>
              <Text className={styles.devName}>乔朋君</Text>
              <Text className={styles.devTitle}>全栈开发者</Text>
              <Text className={styles.devDesc}>
                致力于通过代码创造价值，相信技术的力量可以连接人心。
              </Text>
              <View className={styles.devLinks}>
                <Button
                  className={styles.devLink}
                  onClick={() => Taro.navigateTo({ url: 'https://github.com/qiaopengjun5162' })}
                  hoverClass={styles.devLinkHover}
                >
                  GitHub
                </Button>
                <Button
                  className={styles.devLink}
                  onClick={() => Taro.makePhoneCall({ phoneNumber: 'qiaopengjun5162@gmail.com' })}
                  hoverClass={styles.devLinkHover}
                >
                  Email
                </Button>
              </View>
            </View>
          </View>
        </View>

        {/* 反馈表单 */}
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>意见反馈</Text>
          <View className={styles.feedbackForm}>
            {submitted ? (
              <View className={styles.success}>
                <Text className={styles.successEmoji}>🎉</Text>
                <Text className={styles.successText}>感谢您的反馈！</Text>
              </View>
            ) : (
              <Form onSubmit={handleSubmit}>
                <View className={styles.formGroup}>
                  <Input
                    className={styles.textarea}
                    value={feedback}
                    onInput={(e) => setFeedback(e.detail.value)}
                    placeholder="请输入您的反馈、建议或遇到的问题..."
                    maxlength={500}
                    type="text"
                    autoHeight
                  />
                  <Text className={styles.charCount}>{feedback.length}/500</Text>
                </View>
                {error && <Text className={styles.errorText}>{error}</Text>}
                <Button
                  className={styles.submitBtn}
                  type="primary"
                  formType="submit"
                  disabled={submitting || !feedback.trim()}
                >
                  {submitting ? "提交中..." : "提交反馈"}
                </Button>
              </Form>
            )}
          </View>
        </View>

        {/* 版本信息 */}
        <View className={styles.section}>
          <Text className={styles.sectionTitle}>版本信息</Text>
          <View className={styles.versionInfo}>
            <View className={styles.versionItem}>
              <Text className={styles.versionLabel}>当前版本</Text>
              <Text className={styles.versionValue}>v1.0.0</Text>
            </View>
            <View className={styles.versionItem}>
              <Text className={styles.versionLabel}>最后更新</Text>
              <Text className={styles.versionValue}>2024年6月</Text>
            </View>
            <View className={styles.versionItem}>
              <Text className={styles.versionLabel}>开源协议</Text>
              <Text className={styles.versionValue}>MIT</Text>
            </View>
            <View className={styles.versionItem}>
              <Text className={styles.versionLabel}>项目状态</Text>
              <Text className={styles.versionValue}>开发中</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
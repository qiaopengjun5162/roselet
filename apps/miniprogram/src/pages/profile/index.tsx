import { useState, useEffect } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { getUserProfile } from "@/api";
import { getToken, getUser, logout } from "@/utils/storage";
import { useWasmStore } from "@/utils/useWasmStore";
import { NavBar, TOTAL_HEADER_HEIGHT } from "@/components/NavBar";
import type { UserProfile } from "@roselet/core";
import styles from "./index.module.css";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useWasmStore((s) => s.user);

  useEffect(() => {
    if (!getToken()) {
      Taro.showToast({ title: "请先登录", icon: "none" });
      Taro.navigateTo({ url: "/pages/login/index" });
      return;
    }
    getUserProfile()
      .then(setProfile)
      .catch(() => Taro.showToast({ title: "加载失败", icon: "none" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View className={styles.page}>
        <NavBar title="我的" />
        <View style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 16}px` }}>
          <Text className={styles.loading}>加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className={styles.page}>
      <NavBar title="我的" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 16}px` }}>
        {/* 用户信息卡 */}
        <View className={styles.card}>
          <Text className={styles.nickname}>
            {user?.nickname ?? getUser()?.nickname ?? "未知用户"}
          </Text>
          <Text className={styles.joined}>
            {profile?.user?.created_at
              ? `加入于 ${new Date(profile.user.created_at).toLocaleDateString("zh-CN")}`
              : ""}
          </Text>
        </View>

        {/* 种花统计 */}
        {profile && (
          <View className={styles.statsCard}>
            <Text className={styles.statsTitle}>种花统计</Text>
            <View className={styles.statsRow}>
              <View className={styles.stat}>
                <Text className={styles.statValue}>{profile.total_roses}</Text>
                <Text className={styles.statLabel}>总计</Text>
              </View>
              <View className={styles.stat}>
                <Text className={styles.statValue}>{profile.red_count}</Text>
                <Text className={styles.statLabel}>🌹 红玫瑰</Text>
              </View>
              <View className={styles.stat}>
                <Text className={styles.statValue}>{profile.white_count}</Text>
                <Text className={styles.statLabel}>🤍 白玫瑰</Text>
              </View>
              <View className={styles.stat}>
                <Text className={styles.statValue}>{profile.yellow_count}</Text>
                <Text className={styles.statLabel}>💛 黄玫瑰</Text>
              </View>
            </View>
          </View>
        )}

        {/* 操作 */}
        <View className={styles.actions}>
          <View
            className={styles.actionBtn}
            onClick={() => Taro.navigateTo({ url: "/subpkg-garden/pages/my/index" })}
          >
            <Text>我的花圃</Text>
          </View>
          <View
            className={styles.actionBtn}
            onClick={() => Taro.navigateTo({ url: "/subpkg-garden/pages/plant/index" })}
          >
            <Text>种一朵玫瑰</Text>
          </View>
          <View
            className={styles.actionBtn}
            onClick={() => Taro.navigateTo({ url: "/pages/about/index" })}
          >
            <Text>关于 Roselet</Text>
          </View>
          <View
            className={styles.actionBtnDanger}
            onClick={() => {
              logout();
              Taro.showToast({ title: "已退出", icon: "none" });
              Taro.navigateTo({ url: "/pages/index/index" });
            }}
          >
            <Text className={styles.dangerText}>退出登录</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

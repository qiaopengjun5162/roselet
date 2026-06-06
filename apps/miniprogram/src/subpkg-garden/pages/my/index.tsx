import { useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { getMyRoses } from "@/api";
import { getToken } from "@/utils/storage";
import { RoseCard } from "@/components/RoseCard";
import { NavBar, TOTAL_HEADER_HEIGHT } from "@/components/NavBar";
import type { Rose, PaginatedResponse } from "@roselet/core";
import styles from "../garden/index.module.css";

export default function MyPage() {
  const [roses, setRoses] = useState<Rose[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  async function load(pageNum = 1) {
    if (!getToken()) {
      Taro.showToast({ title: "请先登录", icon: "none" });
      Taro.navigateTo({ url: "/pages/login/index" });
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res: PaginatedResponse<Rose> = await getMyRoses(pageNum);
      setRoses(pageNum === 1 ? res.data : [...roses, ...res.data]);
      setPage(pageNum);
      setHasMore(pageNum * 20 < res.total);
    } catch {
      if (!getToken()) {
        Taro.showToast({ title: "请先登录", icon: "none" });
        Taro.navigateTo({ url: "/pages/login/index" });
        return;
      }
      setError("加载失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  useDidShow(() => { load(1); });

  return (
    <View className={styles.page}>
      <NavBar title="我的花圃" />
      <ScrollView
        className={styles.scroll}
        style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 8}px` }}
        scrollY
        onScrollToLower={() => { if (hasMore && !loading) load(page + 1); }}
      >
        {error ? (
          <View className={styles.state}><Text>{error}</Text></View>
        ) : loading && roses.length === 0 ? (
          <View className={styles.state}><Text>加载中...</Text></View>
        ) : roses.length === 0 ? (
          <View className={styles.state}>
            <Text className={styles.emptyIcon}>🌱</Text>
            <Text className={styles.emptyText}>还没有种过玫瑰</Text>
            <Text
              className={styles.emptyAction}
              onClick={() => Taro.navigateTo({ url: "/subpkg-garden/pages/plant/index" })}
            >
              去种一朵
            </Text>
          </View>
        ) : (
          <View className={styles.grid}>
            {roses.map((rose) => (
              <RoseCard
                key={rose.id}
                rose={rose}
                onTap={() => Taro.navigateTo({ url: `/subpkg-garden/pages/rose/index?id=${rose.id}` })}
              />
            ))}
            {loading && <Text className={styles.loadingMore}>加载更多...</Text>}
            {!hasMore && roses.length > 0 && <Text className={styles.end}>— 已经到底了 —</Text>}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

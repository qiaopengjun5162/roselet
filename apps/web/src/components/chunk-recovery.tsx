"use client";

import { useEffect, useRef } from "react";

const RELOAD_KEY = "roselet:chunk-reload-at";
const COOLDOWN_MS = 20_000;

/**
 * 发版换容器、或者链路整段丢包时，页面 HTML 已经下来，但其中一个 JS chunk
 * 加载失败——表现是「页面能看，按钮全是死的」，控制台留一句
 * `Failed to load chunk ... from module ...`。2026-11-20 在生产冒烟里撞到过一次。
 *
 * 这里只做一件事：发现 `/_next/static/` 的脚本加载失败，就整页重载一次。
 * 重载后要么拿到新版本，要么重试一次网络，比让用户对着死按钮强。
 *
 * 两个刻意的克制：
 * - 只在脚本资源失败时动手，其它错误一概不碰（不然一个图片 404 也会刷新页面）；
 * - 20 秒内只刷一次。真的坏了（比如发版产物缺文件）就停下，别把用户困在刷新循环里。
 */
export function ChunkRecovery({
  // 只为了测试能观察「到底刷没刷」：jsdom 里 location.reload 既不可写也不可 mock。
  reload = () => window.location.reload(),
}: {
  reload?: () => void;
} = {}) {
  // 用 ref 存一下：默认参数每次渲染都是新函数，直接进依赖数组会让监听反复解绑重绑。
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    const onError = (event: Event) => {
      const target = event.target as HTMLScriptElement | null;
      const src = target?.src ?? "";
      if (!src.includes("/_next/static/")) return;

      try {
        const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
        if (Date.now() - last < COOLDOWN_MS) return;
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {
        // 隐私模式下 sessionStorage 可能抛错：那就退化成「每次都刷」，但只刷一次这页。
      }

      reloadRef.current();
    };

    // 资源加载错误不会冒泡，必须用捕获阶段才听得到。
    window.addEventListener("error", onError, true);
    return () => window.removeEventListener("error", onError, true);
  }, []);

  return null;
}

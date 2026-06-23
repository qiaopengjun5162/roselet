"use client";

import { useState, useEffect, useCallback } from "react";

interface StoreSnapshot {
  user_id: string | null;
  nickname: string | null;
  authenticated: boolean;
  filtered: unknown[];
  filter: string;
  page: number;
  total: number;
  has_more: boolean;
  loading: boolean;
  error: string | null;
}

interface StoreAction {
  type: "set_roses" | "append_roses" | "set_filter" | "set_loading" | "set_error" | "set_auth" | "clear_auth" | "reset";
  [key: string]: unknown;
}

interface WasmStoreMod {
  default?: (input?: unknown) => Promise<unknown>;
  store_dispatch: (action: string) => StoreSnapshot;
  store_get_snapshot: () => StoreSnapshot;
}

let wasmStore: { dispatch: (action: string) => StoreSnapshot; snapshot: () => StoreSnapshot } | null = null;

async function initStore() {
  if (wasmStore) return true;
  try {
    const mod = (await import("../../public/pkg/roselet_recommend.js")) as unknown as WasmStoreMod;
    if (typeof mod.default === "function") await mod.default();
    wasmStore = { dispatch: mod.store_dispatch, snapshot: mod.store_get_snapshot };
    return true;
  } catch {
    return false;
  }
}

/**
 * Rust 驱动的状态机 Hook
 * - WASM 可用时：所有 Action 发给 Rust，snapshot 驱动渲染
 * - WASM 不可用时：降级到本地 useState
 */
export function useWasmStore(initialFilter = "all") {
  const [ready, setReady] = useState(false);
  const [snap, setSnap] = useState<StoreSnapshot | null>(null);
  const [localFilter, setLocalFilter] = useState(initialFilter);

  useEffect(() => { initStore().then(setReady); }, []);

  const dispatch = useCallback((action: StoreAction) => {
    if (ready && wasmStore) {
      const next = wasmStore.dispatch(JSON.stringify(action));
      setSnap(next);
    } else {
      // 降级：本地处理 filter
      if (action.type === "set_filter") {
        setLocalFilter((action.filter as string) || "all");
      }
    }
  }, [ready]);

  return {
    ready,
    snap,
    /** 当前筛选器（WASM 不可用时用本地状态） */
    filter: snap?.filter ?? localFilter,
    /** 筛选后的玫瑰列表 */
    items: (snap?.filtered ?? []) as unknown[],
    /** 总数 */
    total: snap?.total ?? 0,
    /** 是否有更多 */
    hasMore: snap?.has_more ?? false,
    /** 是否加载中 */
    loading: snap?.loading ?? true,
    /** 错误信息 */
    auth: snap?.authenticated ?? false,
    userId: snap?.user_id ?? null,
    nickname: snap?.nickname ?? null,
    error: snap?.error,
    dispatch,
  };
}

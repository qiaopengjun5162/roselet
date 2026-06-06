import { useState, useEffect, useCallback } from 'react'
import { initWasm } from './wasm'

interface StoreSnapshot {
  user_id: string | null;
  nickname: string | null;
  authenticated: boolean;
  filtered: unknown[]
  filter: string
  page: number
  total: number
  has_more: boolean
  loading: boolean
  error: string | null
}

interface StoreAction {
  type: 'set_roses' | 'append_roses' | 'set_filter' | 'set_loading' | 'set_error' | 'reset'
  [key: string]: unknown
}

let wasmDispatch: ((action: string) => StoreSnapshot) | null = null
let wasmSnapshot: (() => StoreSnapshot) | null = null

async function initStore() {
  if (wasmDispatch) return true
  try {
    const ok = await initWasm()
    if (!ok) return false
    const mod = await import('../../pkg/roselet_recommend') as unknown as {
      store_dispatch: (a: string) => StoreSnapshot
      store_get_snapshot: () => StoreSnapshot
    }
    wasmDispatch = mod.store_dispatch
    wasmSnapshot = mod.store_get_snapshot
    return true
  } catch {
    return false
  }
}

/**
 * Rust 状态机 Hook（小程序版）
 * 只提取 UI 渲染需要的字段，保持 setData 轻量
 */
export function useWasmStore(initialFilter = 'all') {
  const [ready, setReady] = useState(false)
  const [snap, setSnap] = useState<StoreSnapshot | null>(null)
  const [localFilter, setLocalFilter] = useState(initialFilter)

  useEffect(() => { const load = async () => { try { await initStore(); setReady(true); } catch {} }; load(); }, [])

  const dispatch = useCallback((action: StoreAction) => {
    if (ready && wasmDispatch) {
      const next = wasmDispatch(JSON.stringify(action))
      setSnap(next)
    } else {
      if (action.type === 'set_filter') {
        setLocalFilter((action.filter as string) || 'all')
      }
    }
  }, [ready])

  return {
    ready,
    snap,
    filter: snap?.filter ?? localFilter,
    items: (snap?.filtered ?? []) as unknown[],
    total: snap?.total ?? 0,
    hasMore: snap?.has_more ?? false,
    loading: snap?.loading ?? true,
    auth: snap?.authenticated ?? false,
    userId: snap?.user_id ?? null,
    nickname: snap?.nickname ?? null,
    error: snap?.error,
    dispatch,
  }
}

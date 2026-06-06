import type { PaginatedResponse, Rose } from '@roselet/core';
import { applyGardenCacheAction, buildOptimisticRose } from '@/utils/wasm';

const PUBLIC_GARDEN_KEY = 'roselet_garden_cache_public';

export interface GardenCache {
  roses: Rose[];
  total: number;
  page: number;
  filter: string;
  updated_at: string;
}

type GardenCacheAction =
  | { type: 'set'; roses: Rose[]; total: number; page: number; filter: string; updated_at: string }
  | { type: 'optimistic_create'; rose: Rose; updated_at: string }
  | { type: 'confirm_create'; temp_id: string; rose: Rose; updated_at: string }
  | { type: 'reject_create'; temp_id: string; updated_at: string }
  | { type: 'upsert'; rose: Rose; updated_at: string };

function parseCache(raw: unknown): GardenCache | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as GardenCache;
  } catch {
    wx.removeStorageSync(PUBLIC_GARDEN_KEY);
    return null;
  }
}

function isErrorResult(value: unknown): value is { error: string } {
  return !!value && typeof value === 'object' && 'error' in value;
}

export function loadGardenCache(): GardenCache | null {
  try {
    return parseCache(wx.getStorageSync(PUBLIC_GARDEN_KEY));
  } catch {
    return null;
  }
}

export function saveGardenCache(cache: GardenCache): void {
  wx.setStorageSync(PUBLIC_GARDEN_KEY, JSON.stringify(cache));
}

export async function applyCachedGardenAction(action: GardenCacheAction): Promise<GardenCache | null> {
  const current = loadGardenCache();
  const nextJson = await applyGardenCacheAction(
    current ? JSON.stringify(current) : '',
    JSON.stringify(action),
  );
  if (!nextJson) return current;

  try {
    const parsed = JSON.parse(nextJson) as unknown;
    if (isErrorResult(parsed)) return current;
    const next = parsed as GardenCache;
    saveGardenCache(next);
    return next;
  } catch {
    return current;
  }
}

export async function cacheGardenPage(
  response: PaginatedResponse<Rose>,
  filter = '',
): Promise<GardenCache | null> {
  if (response.page !== 1 || filter) return loadGardenCache();
  return applyCachedGardenAction({
    type: 'set',
    roses: response.data,
    total: response.total,
    page: response.page,
    filter,
    updated_at: new Date().toISOString(),
  });
}

export async function createOptimisticGardenRose(
  plantBodyJson: string,
  nickname = '',
): Promise<string | null> {
  const tempId = `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const rose = await buildOptimisticRose(plantBodyJson, tempId, now, nickname);
  if (!rose || typeof rose !== 'object' || isErrorResult(rose)) return null;

  await applyCachedGardenAction({
    type: 'optimistic_create',
    rose: rose as Rose,
    updated_at: now,
  });
  return tempId;
}

export async function confirmOptimisticGardenRose(tempId: string | null, rose: Rose): Promise<void> {
  if (!tempId) return;
  await applyCachedGardenAction({
    type: 'confirm_create',
    temp_id: tempId,
    rose,
    updated_at: new Date().toISOString(),
  });
}

export async function rejectOptimisticGardenRose(tempId: string | null): Promise<void> {
  if (!tempId) return;
  await applyCachedGardenAction({
    type: 'reject_create',
    temp_id: tempId,
    updated_at: new Date().toISOString(),
  });
}

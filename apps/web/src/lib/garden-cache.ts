import type { PaginatedResponse, Rose } from "@/lib/api";
import { applyGardenCacheAction, buildOptimisticRose } from "@/lib/recommend";

const DB_NAME = "roselet";
const DB_VERSION = 1;
const STORE_NAME = "garden_cache";
const PUBLIC_GARDEN_KEY = "public";

export interface GardenCache {
  roses: Rose[];
  total: number;
  page: number;
  filter: string;
  updated_at: string;
}

type GardenCacheAction =
  | { type: "set"; roses: Rose[]; total: number; page: number; filter: string; updated_at: string }
  | { type: "optimistic_create"; rose: Rose; updated_at: string }
  | { type: "confirm_create"; temp_id: string; rose: Rose; updated_at: string }
  | { type: "reject_create"; temp_id: string; updated_at: string }
  | { type: "upsert"; rose: Rose; updated_at: string };

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = run(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
    tx.onabort = () => db.close();
  });
}

export async function loadGardenCache(): Promise<GardenCache | null> {
  return withStore<GardenCache>("readonly", (store) => store.get(PUBLIC_GARDEN_KEY));
}

export async function saveGardenCache(cache: GardenCache): Promise<void> {
  await withStore<IDBValidKey>("readwrite", (store) => store.put(cache, PUBLIC_GARDEN_KEY));
}

export async function applyCachedGardenAction(action: GardenCacheAction): Promise<GardenCache | null> {
  const current = await loadGardenCache();
  const nextJson = await applyGardenCacheAction(
    current ? JSON.stringify(current) : "",
    JSON.stringify(action),
  );
  if (!nextJson) return current;

  const next = JSON.parse(nextJson) as GardenCache;
  await saveGardenCache(next);
  return next;
}

export async function cacheGardenPage(
  response: PaginatedResponse<Rose>,
  filter = "",
): Promise<GardenCache | null> {
  if (response.page !== 1) return loadGardenCache();
  return applyCachedGardenAction({
    type: "set",
    roses: response.data,
    total: response.total,
    page: response.page,
    filter,
    updated_at: new Date().toISOString(),
  });
}

export async function createOptimisticGardenRose(
  plantBodyJson: string,
  nickname = "",
): Promise<string | null> {
  const tempId = `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const rose = await buildOptimisticRose(plantBodyJson, tempId, now, nickname);
  if (!rose || typeof rose !== "object" || "error" in rose) return null;

  await applyCachedGardenAction({
    type: "optimistic_create",
    rose: rose as Rose,
    updated_at: now,
  });
  return tempId;
}

export async function confirmOptimisticGardenRose(tempId: string | null, rose: Rose): Promise<void> {
  if (!tempId) return;
  await applyCachedGardenAction({
    type: "confirm_create",
    temp_id: tempId,
    rose,
    updated_at: new Date().toISOString(),
  });
}

export async function rejectOptimisticGardenRose(tempId: string | null): Promise<void> {
  if (!tempId) return;
  await applyCachedGardenAction({
    type: "reject_create",
    temp_id: tempId,
    updated_at: new Date().toISOString(),
  });
}

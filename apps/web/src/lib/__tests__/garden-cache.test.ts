const mockBuildOptimisticRose = jest.fn();
const mockApplyGardenCacheAction = jest.fn();

jest.mock("@/lib/recommend", () => ({
  buildOptimisticRose: (...args: unknown[]) => mockBuildOptimisticRose(...args),
  applyGardenCacheAction: (...args: unknown[]) => mockApplyGardenCacheAction(...args),
}));

import {
  applyCachedGardenAction,
  cacheGardenPage,
  confirmOptimisticGardenRose,
  createOptimisticGardenRose,
  loadGardenCache,
  rejectOptimisticGardenRose,
  saveGardenCache,
} from "../garden-cache";

function removeIndexedDb() {
  delete (window as unknown as { indexedDB?: IDBFactory }).indexedDB;
  delete (globalThis as unknown as { indexedDB?: IDBFactory }).indexedDB;
}

function installIndexedDb(initial = new Map<string, unknown>()) {
  const records = new Map(initial);
  const close = jest.fn();
  const createObjectStore = jest.fn();
  const contains = jest.fn(() => true);

  const makeRequest = <T>(result: T) => {
    const request = {
      result,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    queueMicrotask(() => request.onsuccess?.());
    return request as unknown as IDBRequest<T>;
  };

  const db = {
    close,
    createObjectStore,
    objectStoreNames: { contains },
    transaction: jest.fn(() => {
      const tx = {
        oncomplete: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onabort: null as (() => void) | null,
        objectStore: jest.fn(() => ({
          get: jest.fn((key: string) => makeRequest(records.get(key) ?? null)),
          put: jest.fn((value: unknown, key: string) => {
            records.set(key, value);
            return makeRequest(key as IDBValidKey);
          }),
        })),
      };
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    }),
  };

  const factory = {
    open: jest.fn(() => {
      const request = {
        result: db,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null,
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }),
  } as unknown as IDBFactory;

  (window as unknown as { indexedDB: IDBFactory }).indexedDB = factory;
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = factory;
  return { records, factory, db, close, createObjectStore, contains };
}

describe("garden-cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    removeIndexedDb();
    mockBuildOptimisticRose.mockResolvedValue({
      id: "temp-1",
      color: "red",
      gratitude: "hi",
      anxiety: null,
      hope: null,
      user_id: null,
      nickname: "alice",
      like_count: 0,
      ai_reply: null,
      is_private: false,
      created_at: "2026-06-06T00:00:00Z",
      sync_status: "pending",
    });
    mockApplyGardenCacheAction.mockImplementation(async (_cacheJson: string, actionJson: string) => {
      const action = JSON.parse(actionJson);
      const roses = action.roses ?? (action.rose ? [action.rose] : []);
      return JSON.stringify({
        roses,
        total: action.total ?? roses.length,
        page: action.page ?? 1,
        filter: action.filter ?? "",
        updated_at: action.updated_at ?? "now",
      });
    });
  });

  it("returns null when IndexedDB is unavailable", async () => {
    await expect(loadGardenCache()).resolves.toBeNull();
  });

  it("loads and saves public garden cache from IndexedDB", async () => {
    const indexedDb = installIndexedDb();
    const cache = {
      roses: [],
      total: 0,
      page: 1,
      filter: "",
      updated_at: "2026-06-06T00:00:00Z",
    };

    await saveGardenCache(cache);
    await expect(loadGardenCache()).resolves.toEqual(cache);

    expect(indexedDb.factory.open).toHaveBeenCalledWith("roselet", 1);
    expect(indexedDb.contains).toHaveBeenCalledWith("garden_cache");
    expect(indexedDb.createObjectStore).not.toHaveBeenCalled();
    expect(indexedDb.close).toHaveBeenCalled();
  });

  it("creates the object store during IndexedDB upgrades", async () => {
    const indexedDb = installIndexedDb();
    indexedDb.contains.mockReturnValue(false);

    await expect(loadGardenCache()).resolves.toBeNull();

    expect(indexedDb.createObjectStore).toHaveBeenCalledWith("garden_cache");
  });

  it("applies set action through Rust WASM and tolerates missing IndexedDB", async () => {
    const rose = {
      id: "r1",
      color: "yellow",
      gratitude: "cached",
      anxiety: null,
      hope: null,
      user_id: null,
      nickname: null,
      like_count: 0,
      ai_reply: null,
      is_private: false,
      created_at: "2026-06-06T00:00:00Z",
    };
    const cache = await cacheGardenPage({ data: [rose], total: 1, page: 1, per_page: 20 });
    expect(cache?.roses[0].id).toBe("r1");
    expect(mockApplyGardenCacheAction).toHaveBeenCalled();
  });

  it("skips non-first pages for public garden cache", async () => {
    const cache = await cacheGardenPage({ data: [], total: 10, page: 2, per_page: 20 });
    expect(cache).toBeNull();
    expect(mockApplyGardenCacheAction).not.toHaveBeenCalled();
  });

  it("creates an optimistic rose with Rust WASM", async () => {
    const tempId = await createOptimisticGardenRose('{"color":"red","gratitude":"hi"}', "alice");
    expect(tempId).toMatch(/^temp-/);
    expect(mockBuildOptimisticRose).toHaveBeenCalledWith(
      '{"color":"red","gratitude":"hi"}',
      tempId,
      expect.any(String),
      "alice",
    );
    expect(mockApplyGardenCacheAction).toHaveBeenCalledWith(
      "",
      expect.stringContaining('"type":"optimistic_create"'),
    );
  });

  it("does not apply optimistic action when Rust returns an error", async () => {
    mockBuildOptimisticRose.mockResolvedValue({ error: "bad json" });
    await expect(createOptimisticGardenRose("{bad", "alice")).resolves.toBeNull();
    expect(mockApplyGardenCacheAction).not.toHaveBeenCalled();
  });

  it("confirms and rejects optimistic roses through Rust WASM", async () => {
    const rose = {
      id: "real-1",
      color: "red",
      gratitude: "done",
      anxiety: null,
      hope: null,
      user_id: null,
      nickname: null,
      like_count: 0,
      ai_reply: null,
      is_private: false,
      created_at: "2026-06-06T00:00:00Z",
    };
    await confirmOptimisticGardenRose("temp-1", rose);
    await rejectOptimisticGardenRose("temp-2");
    expect(mockApplyGardenCacheAction).toHaveBeenCalledTimes(2);
  });

  it("applies arbitrary cache actions", async () => {
    const cache = await applyCachedGardenAction({
      type: "reject_create",
      temp_id: "temp-1",
      updated_at: "now",
    });
    expect(cache?.total).toBe(0);
  });
});

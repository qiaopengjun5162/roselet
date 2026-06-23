const mockBuildOptimisticRose = jest.fn();
const mockApplyGardenCacheAction = jest.fn();

jest.mock('@/utils/wasm', () => ({
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
} from '@/utils/garden-cache';

const mockStorage: Record<string, string> = {};
let throwOnGet = false;

(global as any).wx = {
  getStorageSync: (key: string) => {
    if (throwOnGet) throw new Error('storage unavailable');
    return mockStorage[key] ?? '';
  },
  setStorageSync: (key: string, value: string) => { mockStorage[key] = value; },
  removeStorageSync: (key: string) => { delete mockStorage[key]; },
};

const rose = {
  id: 'r1',
  color: 'red',
  gratitude: 'thanks',
  anxiety: null,
  hope: null,
  user_id: null,
  nickname: null,
  like_count: 0,
  ai_reply: null,
  is_private: false,
  recipient_nickname: null,
  is_gift: false,
  created_at: '2026-06-06T00:00:00Z',
};

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  throwOnGet = false;
  jest.clearAllMocks();
  mockBuildOptimisticRose.mockResolvedValue({ ...rose, id: 'temp-1', sync_status: 'pending' });
  mockApplyGardenCacheAction.mockImplementation(async (_cacheJson: string, actionJson: string) => {
    const action = JSON.parse(actionJson);
    const roses = action.roses ?? (action.rose ? [action.rose] : []);
    return JSON.stringify({
      roses,
      total: action.total ?? roses.length,
      page: action.page ?? 1,
      filter: action.filter ?? '',
      updated_at: action.updated_at ?? 'now',
    });
  });
});

describe('garden-cache', () => {
  it('loads and saves public garden cache with wx storage', () => {
    const cache = { roses: [rose], total: 1, page: 1, filter: '', updated_at: 'now' };
    saveGardenCache(cache);
    expect(loadGardenCache()).toEqual(cache);
  });

  it('removes corrupt cache and returns null', () => {
    mockStorage.roselet_garden_cache_public = '{broken';
    expect(loadGardenCache()).toBeNull();
    expect(mockStorage.roselet_garden_cache_public).toBeUndefined();
  });

  it('returns null when wx storage read throws', () => {
    throwOnGet = true;
    expect(loadGardenCache()).toBeNull();
  });

  it('stores first public garden page through Rust cache action', async () => {
    const cache = await cacheGardenPage({ data: [rose], total: 1, page: 1, per_page: 20 });
    expect(cache?.roses[0].id).toBe('r1');
    expect(mockApplyGardenCacheAction).toHaveBeenCalledWith('', expect.stringContaining('"type":"set"'));
    expect(loadGardenCache()?.total).toBe(1);
  });

  it('does not replace cache for non-first pages or filters', async () => {
    await cacheGardenPage({ data: [rose], total: 1, page: 2, per_page: 20 });
    await cacheGardenPage({ data: [rose], total: 1, page: 1, per_page: 20 }, 'red');
    expect(mockApplyGardenCacheAction).not.toHaveBeenCalled();
    expect(loadGardenCache()).toBeNull();
  });

  it('creates optimistic rose through Rust offline rules', async () => {
    const tempId = await createOptimisticGardenRose('{"color":"red","gratitude":"hi"}', 'alice');
    expect(tempId).toMatch(/^temp-/);
    expect(mockBuildOptimisticRose).toHaveBeenCalledWith(
      '{"color":"red","gratitude":"hi"}',
      tempId,
      expect.any(String),
      'alice',
    );
    expect(mockApplyGardenCacheAction).toHaveBeenCalledWith('', expect.stringContaining('"type":"optimistic_create"'));
  });

  it('does not write cache when Rust returns error', async () => {
    mockBuildOptimisticRose.mockResolvedValue({ error: 'bad json' });
    await expect(createOptimisticGardenRose('{bad', 'alice')).resolves.toBeNull();
    expect(mockApplyGardenCacheAction).not.toHaveBeenCalled();
    expect(loadGardenCache()).toBeNull();
  });

  it('keeps current cache when Rust action returns error', async () => {
    const cache = { roses: [rose], total: 1, page: 1, filter: '', updated_at: 'old' };
    saveGardenCache(cache);
    mockApplyGardenCacheAction.mockResolvedValue(JSON.stringify({ error: 'bad action' }));
    await expect(applyCachedGardenAction({ type: 'reject_create', temp_id: 'temp-1', updated_at: 'now' })).resolves.toEqual(cache);
    expect(loadGardenCache()).toEqual(cache);
  });

  it('keeps current cache when Rust action returns invalid JSON', async () => {
    const cache = { roses: [rose], total: 1, page: 1, filter: '', updated_at: 'old' };
    saveGardenCache(cache);
    mockApplyGardenCacheAction.mockResolvedValue('{broken');
    await expect(applyCachedGardenAction({ type: 'reject_create', temp_id: 'temp-1', updated_at: 'now' })).resolves.toEqual(cache);
    expect(loadGardenCache()).toEqual(cache);
  });

  it('keeps current cache when Rust action returns null', async () => {
    const cache = { roses: [rose], total: 1, page: 1, filter: '', updated_at: 'old' };
    saveGardenCache(cache);
    mockApplyGardenCacheAction.mockResolvedValue(null);
    await expect(applyCachedGardenAction({ type: 'reject_create', temp_id: 'temp-1', updated_at: 'now' })).resolves.toEqual(cache);
    expect(loadGardenCache()).toEqual(cache);
  });

  it('does not apply optimistic action when Rust returns null', async () => {
    mockBuildOptimisticRose.mockResolvedValue(null);
    await expect(createOptimisticGardenRose('{"color":"red"}')).resolves.toBeNull();
    expect(mockApplyGardenCacheAction).not.toHaveBeenCalled();
  });

  it('confirms and rejects optimistic roses through Rust cache action', async () => {
    await confirmOptimisticGardenRose('temp-1', rose);
    await rejectOptimisticGardenRose('temp-2');
    expect(mockApplyGardenCacheAction).toHaveBeenCalledTimes(2);
  });

  it('ignores confirm and reject when temp id is missing', async () => {
    await confirmOptimisticGardenRose(null, rose);
    await rejectOptimisticGardenRose(null);
    expect(mockApplyGardenCacheAction).not.toHaveBeenCalled();
  });
});

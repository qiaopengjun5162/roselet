import { request } from '@/utils/request';

type WxSuccessCallback = (res: { statusCode: number; data: unknown; header?: Record<string, string> }) => void;
type WxFailCallback = (err: { errMsg: string }) => void;

let lastRequestOpts: Record<string, unknown> | null = null;
let mockSuccess: WxSuccessCallback;
let mockFail: WxFailCallback;

const mockStorage: Record<string, string> = {};

(global as any).wx = {
  getStorageSync: (key: string) => mockStorage[key] ?? '',
  setStorageSync: (key: string, value: string) => { mockStorage[key] = value; },
  removeStorageSync: (key: string) => { delete mockStorage[key]; },
  request: (opts: {
    url: string;
    method?: string;
    data?: string;
    header?: Record<string, string>;
    success: WxSuccessCallback;
    fail: WxFailCallback;
  }) => {
    lastRequestOpts = opts as unknown as Record<string, unknown>;
    mockSuccess = opts.success;
    mockFail = opts.fail;
  },
};

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  lastRequestOpts = null;
});

describe('request', () => {
  // ── Success cases ──────────────────────────────────
  it('resolves with parsed data on 2xx', async () => {
    const promise = request<{ ok: boolean }>('/api/garden');
    mockSuccess({ statusCode: 200, data: { ok: true } });
    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('resolves on 201 Created', async () => {
    const promise = request('/api/rose', { method: 'POST' });
    mockSuccess({ statusCode: 201, data: { id: '42' } });
    await expect(promise).resolves.toEqual({ id: '42' });
  });

  it('resolves on 204 No Content with null body', async () => {
    const promise = request('/api/rose/1/like', { method: 'DELETE' });
    mockSuccess({ statusCode: 204, data: null });
    await expect(promise).resolves.toBeNull();
  });

  // ── Error cases ────────────────────────────────────
  it('rejects on 400 Bad Request', async () => {
    const promise = request('/api/garden');
    mockSuccess({ statusCode: 400, data: { error: 'bad request' } });
    await expect(promise).rejects.toThrow('HTTP 400');
  });

  it('rejects on 401 Unauthorized', async () => {
    const promise = request('/api/my/roses', { auth: true });
    mockSuccess({ statusCode: 401, data: { error: 'unauthorized' } });
    await expect(promise).rejects.toThrow('HTTP 401');
  });

  it('rejects on 500 Internal Server Error', async () => {
    const promise = request('/api/garden');
    mockSuccess({ statusCode: 500, data: 'error' });
    await expect(promise).rejects.toThrow('HTTP 500');
  });

  it('rejects on network failure', async () => {
    const promise = request('/api/garden');
    mockFail({ errMsg: 'request:fail timeout' });
    await expect(promise).rejects.toThrow('request:fail timeout');
  });

  // ── Auth header ────────────────────────────────────
  it('attaches Authorization header when auth=true and token exists', async () => {
    mockStorage['roselet_token'] = 'my-jwt';
    const promise = request('/api/my/roses', { auth: true });
    mockSuccess({ statusCode: 200, data: [] });
    await promise;
    expect((lastRequestOpts?.header as Record<string, string>)?.Authorization).toBe('Bearer my-jwt');
  });

  it('omits Authorization header when auth=true but no token', async () => {
    const promise = request('/api/my/roses', { auth: true });
    mockSuccess({ statusCode: 200, data: [] });
    await promise;
    expect((lastRequestOpts?.header as Record<string, string>)?.Authorization).toBeUndefined();
  });

  it('omits Authorization header when auth=false even with token', async () => {
    mockStorage['roselet_token'] = 'my-jwt';
    const promise = request('/api/garden', { auth: false });
    mockSuccess({ statusCode: 200, data: [] });
    await promise;
    expect((lastRequestOpts?.header as Record<string, string>)?.Authorization).toBeUndefined();
  });

  // ── Default method ─────────────────────────────────
  it('defaults to GET method', async () => {
    const promise = request('/api/garden');
    mockSuccess({ statusCode: 200, data: [] });
    await promise;
    expect(lastRequestOpts?.method).toBe('GET');
  });
});

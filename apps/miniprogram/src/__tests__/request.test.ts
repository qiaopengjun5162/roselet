import { request } from '@/utils/request';

type WxCb = (res: { statusCode: number; data: unknown }) => void;
type WxFail = (err: { errMsg: string }) => void;

// 请求队列：每次 wx.request 从队列头部取响应
const responseQueue: Array<{ statusCode: number; data: unknown } | { errMsg: string }> = [];

let capturedOpts: Record<string, unknown>[] = [];

const mockStorage: Record<string, string> = {};

(global as any).wx = {
  getStorageSync: (key: string) => mockStorage[key] ?? '',
  setStorageSync: (key: string, value: string) => { mockStorage[key] = value; },
  removeStorageSync: (key: string) => { delete mockStorage[key]; },
  request: (opts: {
    url: string; method?: string; data?: string;
    header?: Record<string, string>;
    success: WxCb; fail: WxFail;
  }) => {
    capturedOpts.push(opts as unknown as Record<string, unknown>);
    const resp = responseQueue.shift();
    if (!resp) return;
    if ('errMsg' in resp) {
      opts.fail(resp as { errMsg: string });
    } else {
      opts.success(resp);
    }
  },
};

function enqueue(res: { statusCode: number; data: unknown } | { errMsg: string }) {
  responseQueue.push(res);
}

function lastOpts() { return capturedOpts[capturedOpts.length - 1]; }

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  capturedOpts = [];
  responseQueue.length = 0;
});

describe('request', () => {
  // ── 基础成功 ─────────────────────────────────────────
  it('resolves with parsed data on 2xx', async () => {
    enqueue({ statusCode: 200, data: { ok: true } });
    await expect(request<{ ok: boolean }>('/api/garden')).resolves.toEqual({ ok: true });
  });

  it('resolves on 201 Created', async () => {
    enqueue({ statusCode: 201, data: { id: '42' } });
    await expect(request('/api/rose', { method: 'POST' })).resolves.toEqual({ id: '42' });
  });

  it('resolves on 204 No Content with null body', async () => {
    enqueue({ statusCode: 204, data: null });
    await expect(request('/api/rose/1/like', { method: 'DELETE' })).resolves.toBeNull();
  });

  // ── 错误 ─────────────────────────────────────────────
  it('rejects on 400 Bad Request', async () => {
    enqueue({ statusCode: 400, data: { error: 'bad request' } });
    await expect(request('/api/garden')).rejects.toThrow('HTTP 400');
  });

  it('rejects on 500 Internal Server Error', async () => {
    enqueue({ statusCode: 500, data: 'error' });
    await expect(request('/api/garden')).rejects.toThrow('HTTP 500');
  });

  it('rejects on network failure', async () => {
    enqueue({ errMsg: 'request:fail timeout' });
    await expect(request('/api/garden')).rejects.toThrow('request:fail timeout');
  });

  // ── Auth header ───────────────────────────────────────
  it('attaches Authorization header when auth=true and token exists', async () => {
    mockStorage['roselet_token'] = 'my-jwt';
    enqueue({ statusCode: 200, data: [] });
    await request('/api/my/roses', { auth: true });
    expect((lastOpts()?.header as Record<string, string>)?.Authorization).toBe('Bearer my-jwt');
  });

  it('omits Authorization header when auth=true but no token', async () => {
    enqueue({ statusCode: 200, data: [] });
    await request('/api/my/roses', { auth: true });
    expect((lastOpts()?.header as Record<string, string>)?.Authorization).toBeUndefined();
  });

  it('omits Authorization header when auth=false even with token', async () => {
    mockStorage['roselet_token'] = 'my-jwt';
    enqueue({ statusCode: 200, data: [] });
    await request('/api/garden', { auth: false });
    expect((lastOpts()?.header as Record<string, string>)?.Authorization).toBeUndefined();
  });

  it('defaults to GET method', async () => {
    enqueue({ statusCode: 200, data: [] });
    await request('/api/garden');
    expect(lastOpts()?.method).toBe('GET');
  });

  // ── 双令牌静默刷新 ─────────────────────────────────────
  it('silently refreshes and retries on 401 with valid refresh token', async () => {
    mockStorage['roselet_token'] = 'expired-access';
    mockStorage['roselet_refresh_token'] = 'valid-refresh';

    // 第一次请求 401，刷新请求 200，重试请求 200
    enqueue({ statusCode: 401, data: { error: 'unauthorized' } });
    enqueue({ statusCode: 200, data: { access_token: 'new-access' } });
    enqueue({ statusCode: 200, data: [{ id: '1' }] });

    const result = await request('/api/my/roses', { auth: true });

    expect(result).toEqual([{ id: '1' }]);
    // 应有 3 次 wx.request：原始 + 刷新 + 重试
    expect(capturedOpts).toHaveLength(3);
    // 新 token 应已保存
    expect(mockStorage['roselet_token']).toBe('new-access');
    // 重试请求应携带新 token
    expect((capturedOpts[2]?.header as Record<string, string>)?.Authorization).toBe('Bearer new-access');
  });

  it('rejects with 401 when no refresh token available', async () => {
    mockStorage['roselet_token'] = 'expired-access';
    // 无 refresh token

    enqueue({ statusCode: 401, data: { error: 'unauthorized' } });

    await expect(request('/api/my/roses', { auth: true })).rejects.toThrow('HTTP 401');
    expect(mockStorage['roselet_token']).toBeUndefined();
  });

  it('logs out and rejects when refresh token is expired', async () => {
    mockStorage['roselet_token'] = 'expired-access';
    mockStorage['roselet_refresh_token'] = 'expired-refresh';

    enqueue({ statusCode: 401, data: { error: 'unauthorized' } });
    enqueue({ statusCode: 401, data: { error: 'refresh expired' } }); // 刷新也失败

    await expect(request('/api/my/roses', { auth: true })).rejects.toThrow();
    // 登出后 token 被清除
    expect(mockStorage['roselet_token']).toBeUndefined();
    expect(mockStorage['roselet_refresh_token']).toBeUndefined();
  });

  it('does not retry on 401 when auth=false', async () => {
    enqueue({ statusCode: 401, data: { error: 'unauthorized' } });
    await expect(request('/api/garden')).rejects.toThrow('HTTP 401');
    // 只有 1 次请求，不触发刷新
    expect(capturedOpts).toHaveLength(1);
  });
});

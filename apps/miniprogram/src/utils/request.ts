import { getToken, setToken, getRefreshToken, logout } from '@/utils/storage';

const BASE_URL = 'http://localhost:3001';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  /** 是否需要 JWT 认证，为 true 时自动附加 Authorization header */
  auth?: boolean;
}

interface RefreshResponse {
  access_token: string;
}

// 防止并发刷新：同一时间只有一个刷新请求
let refreshing: Promise<string | null> | null = null;

function doRequest<T>(path: string, opts: RequestOptions, token?: string | null): Promise<T> {
  const { method = 'GET', data } = opts;
  const header: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) header['Authorization'] = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method,
      data: data ? JSON.stringify(data) : undefined,
      header,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as T);
        } else {
          reject(Object.assign(new Error(`HTTP ${res.statusCode}`), { statusCode: res.statusCode }));
        }
      },
      fail: (err) => reject(new Error(err.errMsg)),
    });
  });
}

// 用 Refresh Token 换取新 Access Token，成功返回新 token，失败返回 null
function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);

  refreshing = doRequest<RefreshResponse>('/api/auth/refresh', {
    method: 'POST',
    data: { refresh_token: refreshToken },
  }).then((res) => {
    setToken(res.access_token);
    return res.access_token;
  }).catch(() => {
    // Refresh Token 失效，强制登出
    logout();
    return null;
  }).finally(() => {
    refreshing = null;
  });

  return refreshing;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = opts.auth ? getToken() : null;

  try {
    return await doRequest<T>(path, opts, token);
  } catch (err: unknown) {
    // 401 且有 auth 要求时，尝试静默刷新
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 401 && opts.auth) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // 用新 token 重试一次
        return doRequest<T>(path, opts, newToken);
      }
    }
    throw err;
  }
}

export async function submitFeedback(content: string): Promise<boolean> {
  try {
    const token = getToken();
    const response = await wx.request({
      url: `${API_BASE}/api/feedback`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      data: { content },
    });

    return response.statusCode === 201;
  } catch (err) {
    return false;
  }
}

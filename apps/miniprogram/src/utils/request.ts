import { getToken, setToken, getRefreshToken, logout } from '@/utils/storage';

/**
 * 后端地址。小程序里没有「同源」这回事，`wx.request` 必须给绝对地址。
 *
 * 这里原来写死 `http://localhost:3001`——在开发者工具里能跑（工具和本地后端同机），
 * **一到真机就必然失败**：手机上的 localhost 是手机自己。这就是「真机闭环」一直差一步的
 * 直接原因之一，而且它在工具里看起来是好的，很难被发现。
 *
 * 三档：
 *   1. 构建时 `TARO_APP_API_BASE=https://...` 覆盖（换正式域名时用这个）；
 *   2. 生产构建 → 线上 https 入口；
 *   3. 开发/测试 → 本机 3001。
 *
 * 注意：小程序对域名有硬要求，代码正确也绕不过去——必须是 https、且该域名在
 * 微信后台「开发管理 → 服务器域名 → request 合法域名」里（真机不走 `urlCheck:false`，
 * 那只是开发者工具的开关）。详见 DEPLOYMENT.md「小程序」一节。
 */
const PROD_API_BASE = 'https://roselet.47.131.238.0.sslip.io';

const ENV_API_BASE = process.env.TARO_APP_API_BASE;

export const API_BASE_URL =
  (ENV_API_BASE && ENV_API_BASE.trim()) ||
  (process.env.NODE_ENV === 'production' ? PROD_API_BASE : 'http://localhost:3001');

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
  const body = typeof data === 'string' ? data : data ? JSON.stringify(data) : undefined;

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method,
      data: body,
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
interface RefreshResponse {
  access_token: string;
}

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
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 401 && opts.auth) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // 用新 token 重试一次
        return doRequest<T>(path, opts, newToken);
      }
      logout();
    }
    throw err;
  }
}

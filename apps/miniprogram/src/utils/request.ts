import { getToken } from '@/utils/storage';

/** 后端 API 地址，开发环境指向本地 */
const BASE_URL = 'http://localhost:3001';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  /** 是否需要 JWT 认证，为 true 时自动附加 Authorization header */
  auth?: boolean;
}

/**
 * 通用 HTTP 请求封装，基于 wx.request。
 * 自动处理 JWT 认证、JSON 序列化、HTTP 状态码校验。
 */
export function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', data, auth = false } = opts;
  const header: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) header['Authorization'] = `Bearer ${token}`;
  }
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
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      },
      fail: (err) => reject(new Error(err.errMsg)),
    });
  });
}

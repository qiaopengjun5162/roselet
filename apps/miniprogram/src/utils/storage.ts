import type { User } from '@roselet/core';

const TOKEN_KEY = 'roselet_token';
const REFRESH_KEY = 'roselet_refresh_token';
const USER_KEY = 'roselet_user';

/** 从本地存储获取 JWT token，未登录返回 null */
export function getToken(): string | null {
  return wx.getStorageSync(TOKEN_KEY) || null;
}

/** 保存 JWT token 到本地存储 */
export function setToken(token: string): void {
  wx.setStorageSync(TOKEN_KEY, token);
}

/** 获取 Refresh Token */
export function getRefreshToken(): string | null {
  return wx.getStorageSync(REFRESH_KEY) || null;
}

/** 保存 Refresh Token */
export function setRefreshToken(token: string): void {
  wx.setStorageSync(REFRESH_KEY, token);
}

/** 从本地存储获取用户信息，数据损坏时自动清除并返回 null */
export function getUser(): User | null {
  const raw = wx.getStorageSync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    wx.removeStorageSync(USER_KEY);
    return null;
  }
}

/** 保存用户信息到本地存储 */
export function setUser(user: User): void {
  wx.setStorageSync(USER_KEY, JSON.stringify(user));
}

/** 清除本地存储的 token 和用户信息 */
export function logout(): void {
  wx.removeStorageSync(TOKEN_KEY);
  wx.removeStorageSync(REFRESH_KEY);
  wx.removeStorageSync(USER_KEY);
}

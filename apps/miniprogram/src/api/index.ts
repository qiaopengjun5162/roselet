import type {
  AuthResponse, Rose, CreateRose,
  PaginatedResponse, UserProfile, LikeResponse,
} from '@roselet/core';
import { request } from '@/utils/request';

/** 用户注册（昵称即账号），返回 JWT token 和用户信息 */
export function register(nickname: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', { method: 'POST', data: { nickname } });
}

/** 获取花圃玫瑰列表，支持分页和颜色筛选 */
export function getGarden(page = 1, perPage = 20, color?: string): Promise<PaginatedResponse<Rose>> {
  let path = `/api/garden?page=${page}&per_page=${perPage}`;
  if (color) path += `&color=${color}`;
  return request<PaginatedResponse<Rose>>(path);
}

/** 获取单朵玫瑰详情 */
export function getRose(id: string): Promise<Rose> {
  return request<Rose>(`/api/rose/${id}`);
}

/** 种一朵玫瑰（需 JWT 认证） */
export function createRose(data: CreateRose): Promise<Rose> {
  return request<Rose>('/api/rose', { method: 'POST', data, auth: true });
}

/** 获取当前用户资料和种花统计（需 JWT 认证） */
export function getUserProfile(): Promise<UserProfile> {
  return request<UserProfile>('/api/user/profile', { auth: true });
}

/** 点赞/取消点赞（需 JWT 认证），返回当前点赞状态和计数 */
export function toggleLike(roseId: string): Promise<LikeResponse> {
  return request<LikeResponse>(`/api/rose/${roseId}/like`, { method: 'POST', auth: true });
}

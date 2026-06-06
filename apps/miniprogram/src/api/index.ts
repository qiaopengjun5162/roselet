import type {
  AuthResponse, Rose, CreateRose,
  PaginatedResponse, UserProfile, LikeResponse,
} from '@roselet/core';
import { request } from '@/utils/request';

/** 用户注册（昵称即账号），返回双令牌 + 用户信息 */
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

/** 编辑玫瑰（需 JWT，仅 owner） */
export function updateRose(id: string, data: Partial<CreateRose>): Promise<Rose> {
  return request<Rose>(`/api/rose/${id}`, { method: 'PUT', data, auth: true });
}

/** 删除玫瑰（需 JWT，仅 owner） */
export function deleteRose(id: string): Promise<void> {
  return request<void>(`/api/rose/${id}`, { method: 'DELETE', auth: true });
}

/** 获取当前用户的花圃（需 JWT，分页） */
export function getMyRoses(page = 1, perPage = 20): Promise<PaginatedResponse<Rose>> {
  return request<PaginatedResponse<Rose>>(`/api/my/roses?page=${page}&per_page=${perPage}`, { auth: true });
}

/** 获取当前用户资料和种花统计（需 JWT 认证） */
export function getUserProfile(): Promise<UserProfile> {
  return request<UserProfile>('/api/user/profile', { auth: true });
}

/** 点赞/取消点赞（需 JWT 认证），返回当前点赞状态和计数 */
export function toggleLike(roseId: string): Promise<LikeResponse> {
  return request<LikeResponse>(`/api/rose/${roseId}/like`, { method: 'POST', auth: true });
}

/** 提交反馈（可选 JWT） */
export function submitFeedback(content: string): Promise<boolean> {
  return request<{ id: number }>('/api/feedback', { method: 'POST', auth: false, data: { content } })
    .then(() => true)
    .catch(() => false);
}

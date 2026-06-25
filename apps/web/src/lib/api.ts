const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const AUTH_API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || process.env.NEXT_PUBLIC_WORKER_API_URL || API_BASE;
const READ_API_BASE = process.env.NEXT_PUBLIC_READ_API_URL || process.env.NEXT_PUBLIC_WORKER_API_URL || API_BASE;

export interface User {
  id: string;
  nickname: string;
  created_at: string;
  deleted_at?: string | null;
  deletion_reason?: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

export function setRefreshToken(token: string) {
  localStorage.setItem("refresh_token", token);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem("user");
    return null;
  }
}

export function setUser(user: User) {
  localStorage.setItem("user", JSON.stringify(user));
}

function clearAuthState() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
}

export function logout() {
  const refreshToken = getRefreshToken();
  clearAuthState();
  // 异步撤销服务端 refresh token，不阻塞登出
  if (refreshToken) {
    fetch(`${AUTH_API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    }).catch(() => {});
  }
}

export interface DeactivateAccountResponse {
  success: boolean;
  restore_deadline: string;
}

let refreshing: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshing = fetch(`${AUTH_API_BASE}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("refresh failed");
      const data: { access_token: string } = await res.json();
      setToken(data.access_token);
      return data.access_token;
    })
    .catch(() => {
      clearAuthState();
      return null;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

export async function register(nickname: string, passphrase?: string): Promise<AuthResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, passphrase: passphrase || null }),
    });
  } catch {
    throw new Error("Failed to fetch");
  }
  if (!res.ok) {
    let body: { error?: string } = {};
    try { body = await res.json(); } catch { /* ignore parse errors */ }
    throw new Error(body.error || "Failed to register");
  }
  return res.json();
}

export interface Rose {
  id: string;
  color: string;
  gratitude: string | null;
  anxiety: string | null;
  hope: string | null;
  user_id: string | null;
  nickname: string | null;
  like_count: number;
  ai_reply: string | null;
  is_private: boolean;
  created_at: string;
  recipient_nickname: string | null;
  is_gift: boolean;
}

export interface CreateRose {
  color: string;
  gratitude?: string;
  anxiety?: string;
  hope?: string;
  is_private?: boolean;
  recipient_nickname?: string;
}

export interface UpdateRose {
  is_private?: boolean;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function retryHeaders(headers: HeadersInit | undefined, token: string): Record<string, string> {
  return {
    ...Object.fromEntries(new Headers(headers).entries()),
    Authorization: `Bearer ${token}`,
  };
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401 && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return fetch(url, { ...init, headers: retryHeaders(init?.headers, newToken) });
    }
  }
  if (res.status === 401) clearAuthState();
  return res;
}

export async function createRose(data: CreateRose): Promise<Rose> {
  const { buildPlantBody } = await import("@/lib/recommend");
  const {
    createOptimisticGardenRose,
    confirmOptimisticGardenRose,
    rejectOptimisticGardenRose,
  } = await import("@/lib/garden-cache");
  const body = await buildPlantBody(
    data.color,
    data.gratitude ?? null,
    data.anxiety ?? null,
    data.hope ?? null,
    data.is_private ?? false,
    data.recipient_nickname ?? undefined,
  );
  const tempId = await createOptimisticGardenRose(body, getUser()?.nickname ?? "");

  try {
    const res = await authFetch(`${API_BASE}/api/rose`, {
      method: "POST",
      headers: authHeaders(),
      body,
    });
    if (!res.ok) throw new Error("Failed to create rose");
    const rose: Rose = await res.json();
    await confirmOptimisticGardenRose(tempId, rose);
    return rose;
  } catch (error) {
    await rejectOptimisticGardenRose(tempId);
    throw error;
  }
}

export async function updateRose(id: string, data: UpdateRose): Promise<Rose> {
  const res = await authFetch(`${API_BASE}/api/rose/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update rose");
  return res.json();
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export async function getGarden(page = 1, perPage = 20, color?: string): Promise<PaginatedResponse<Rose>> {
  const { buildGardenUrl } = await import("@/lib/recommend");
  const url = await buildGardenUrl(READ_API_BASE, page, perPage, color);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch garden");
  const data: PaginatedResponse<Rose> = await res.json();
  if (page === 1 && !color) {
    const { cacheGardenPage } = await import("@/lib/garden-cache");
    await cacheGardenPage(data);
  }
  return data;
}

export interface UsageStats {
  total_users: number;
  total_roses: number;
  public_roses: number;
  private_roses: number;
  total_likes: number;
  total_feedback: number;
  users_last_7_days: number;
  roses_last_7_days: number;
  feedback_last_7_days: number;
  latest_rose_at: string | null;
  latest_feedback_at: string | null;
  user_goal: {
    current: number;
    goal: number;
    percent: number;
  };
  private_rose_monthly_limit: number;
}

export async function getUsageStats(): Promise<UsageStats> {
  const res = await authFetch(`${READ_API_BASE}/api/stats`, {
    headers: authHeaders(),
  });
  if (res.status === 403) throw new Error("STATS_FORBIDDEN");
  if (!res.ok) throw new Error("Failed to fetch usage stats");
  return res.json();
}

export interface AdminFeedbackItem {
  id: number;
  user_id: string | null;
  nickname: string | null;
  content: string;
  created_at: string;
}

export interface AdminFeedbackResponse {
  data: AdminFeedbackItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export async function getAdminFeedback(page = 1, perPage = 20): Promise<AdminFeedbackResponse> {
  const res = await authFetch(`${READ_API_BASE}/api/admin/feedback?page=${page}&per_page=${perPage}`, {
    headers: authHeaders(),
  });
  if (res.status === 403) throw new Error("ADMIN_FEEDBACK_FORBIDDEN");
  if (!res.ok) throw new Error("Failed to fetch admin feedback");
  return res.json();
}

export async function getRose(id: string): Promise<Rose> {
  const res = await authFetch(`${READ_API_BASE}/api/rose/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch rose");
  return res.json();
}

export async function getMyRoses(page = 1, perPage = 20): Promise<PaginatedResponse<Rose>> {
  const res = await authFetch(`${API_BASE}/api/my/roses?page=${page}&per_page=${perPage}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch my roses");
  return res.json();
}

export interface UserProfile {
  user: User;
  total_roses: number;
  red_count: number;
  white_count: number;
  yellow_count: number;
}

export async function getUserProfile(): Promise<UserProfile> {
  const res = await authFetch(`${API_BASE}/api/user/profile`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function deactivateAccount(reason?: string): Promise<DeactivateAccountResponse> {
  const res = await authFetch(`${API_BASE}/api/auth/deactivate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason: reason || null }),
  });
  if (!res.ok) throw new Error("Failed to deactivate account");
  const data: DeactivateAccountResponse = await res.json();
  clearAuthState();
  return data;
}

export interface LikeResponse {
  liked: boolean;
  like_count: number;
}

export async function toggleLike(roseId: string): Promise<LikeResponse> {
  const res = await authFetch(`${API_BASE}/api/rose/${roseId}/like`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to toggle like");
  return res.json();
}

export interface FeedbackRequest {
  content: string;
}

export interface FeedbackResponse {
  id: number;
}

export interface HealthResponse {
  status: string;
  database: string;
  version: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error("Failed to fetch health");
  return res.json();
}

export async function submitFeedback(content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      return { success: true };
    } else {
      const error = await res.text();
      return { success: false, error: error || "Failed to submit feedback" };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface User {
  id: string;
  nickname: string;
  created_at: string;
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

export function logout() {
  const refreshToken = getRefreshToken();
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  // 异步撤销服务端 refresh token，不阻塞登出
  if (refreshToken) {
    fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    }).catch(() => {});
  }
}

let refreshing: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshing = fetch(`${API_BASE}/api/auth/refresh`, {
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
      // Refresh token 失效，强制登出
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
      return null;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

export async function register(nickname: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname }),
  });
  if (!res.ok) throw new Error("Failed to register");
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
}

export interface CreateRose {
  color: string;
  gratitude?: string;
  anxiety?: string;
  hope?: string;
  is_private?: boolean;
}

export interface UpdateRose {
  color?: string;
  gratitude?: string | null;
  anxiety?: string | null;
  hope?: string | null;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 401 && getRefreshToken()) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${newToken}`);
      return fetch(url, { ...init, headers });
    }
  }
  return res;
}

export async function createRose(data: CreateRose): Promise<Rose> {
  const { buildPlantBody } = await import("@/lib/recommend");
  const body = await buildPlantBody(
    data.color,
    data.gratitude ?? null,
    data.anxiety ?? null,
    data.hope ?? null,
    data.is_private ?? false,
  );
  const res = await authFetch(`${API_BASE}/api/rose`, {
    method: "POST",
    headers: authHeaders(),
    body,
  });
  if (!res.ok) throw new Error("Failed to create rose");
  return res.json();
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

export async function deleteRose(id: string): Promise<void> {
  const res = await authFetch(`${API_BASE}/api/rose/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete rose");
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export async function getGarden(page = 1, perPage = 20, color?: string): Promise<PaginatedResponse<Rose>> {
  const { buildGardenUrl } = await import("@/lib/recommend");
  const url = await buildGardenUrl(API_BASE, page, perPage, color);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch garden");
  return res.json();
}

export async function getRose(id: string): Promise<Rose> {
  const res = await authFetch(`${API_BASE}/api/rose/${id}`, {
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
      const data: FeedbackResponse = await res.json();
      return { success: true };
    } else {
      const error = await res.text();
      return { success: false, error: error || "Failed to submit feedback" };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

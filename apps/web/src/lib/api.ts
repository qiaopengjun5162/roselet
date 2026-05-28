const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface User {
  id: string;
  nickname: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("user");
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user: User) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
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
  created_at: string;
}

export interface CreateRose {
  color: string;
  gratitude?: string;
  anxiety?: string;
  hope?: string;
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

export async function createRose(data: CreateRose): Promise<Rose> {
  const res = await fetch(`${API_BASE}/api/rose`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create rose");
  return res.json();
}

export async function updateRose(id: string, data: UpdateRose): Promise<Rose> {
  const res = await fetch(`${API_BASE}/api/rose/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update rose");
  return res.json();
}

export async function deleteRose(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/rose/${id}`, {
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
  let url = `${API_BASE}/api/garden?page=${page}&per_page=${perPage}`;
  if (color) url += `&color=${color}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch garden");
  return res.json();
}

export async function getRose(id: string): Promise<Rose> {
  const res = await fetch(`${API_BASE}/api/rose/${id}`);
  if (!res.ok) throw new Error("Failed to fetch rose");
  return res.json();
}

export async function getMyRoses(page = 1, perPage = 20): Promise<PaginatedResponse<Rose>> {
  const res = await fetch(`${API_BASE}/api/my/roses?page=${page}&per_page=${perPage}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch my roses");
  return res.json();
}

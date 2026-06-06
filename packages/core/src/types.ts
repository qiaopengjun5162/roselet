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

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface UserProfile {
  user: User;
  total_roses: number;
  red_count: number;
  white_count: number;
  yellow_count: number;
}

export interface LikeResponse {
  liked: boolean;
  like_count: number;
}

export interface FeedbackResponse {
  id: number;
}

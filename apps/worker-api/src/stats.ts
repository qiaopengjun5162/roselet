import { neon } from "@neondatabase/serverless";

type Bindings = {
  DATABASE_URL?: string;
};

type UsageStatsRow = {
  total_users: string | number | null;
  total_roses: string | number | null;
  public_roses: string | number | null;
  private_roses: string | number | null;
  total_likes: string | number | null;
  total_feedback: string | number | null;
  users_last_7_days: string | number | null;
  roses_last_7_days: string | number | null;
  feedback_last_7_days: string | number | null;
  latest_rose_at: string | null;
  latest_feedback_at: string | null;
};

type UsageGoal = {
  current: number;
  goal: number;
  percent: number;
};

export type UsageStats = {
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
  user_goal: UsageGoal;
};

function toCount(value: string | number | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function progressToGoal(current: number, goal: number): UsageGoal {
  if (goal <= 0) {
    return { current, goal, percent: 0 };
  }

  return {
    current,
    goal,
    percent: Math.min(100, Math.round((current / goal) * 100)),
  };
}

export function normalizeUsageStats(row: UsageStatsRow): UsageStats {
  const totalUsers = toCount(row.total_users);

  return {
    total_users: totalUsers,
    total_roses: toCount(row.total_roses),
    public_roses: toCount(row.public_roses),
    private_roses: toCount(row.private_roses),
    total_likes: toCount(row.total_likes),
    total_feedback: toCount(row.total_feedback),
    users_last_7_days: toCount(row.users_last_7_days),
    roses_last_7_days: toCount(row.roses_last_7_days),
    feedback_last_7_days: toCount(row.feedback_last_7_days),
    latest_rose_at: row.latest_rose_at,
    latest_feedback_at: row.latest_feedback_at,
    user_goal: progressToGoal(totalUsers, 100),
  };
}

export async function getUsageStats(env: Bindings): Promise<UsageStats> {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = neon(env.DATABASE_URL);
  const rows = (await sql`
    SELECT
      (SELECT COUNT(*)::text FROM users WHERE deleted_at IS NULL) AS total_users,
      (SELECT COUNT(*)::text FROM roses) AS total_roses,
      (SELECT COUNT(*)::text FROM roses WHERE is_private = false) AS public_roses,
      (SELECT COUNT(*)::text FROM roses WHERE is_private = true) AS private_roses,
      (SELECT COUNT(*)::text FROM likes) AS total_likes,
      (SELECT COUNT(*)::text FROM feedbacks) AS total_feedback,
      (SELECT COUNT(*)::text FROM users WHERE deleted_at IS NULL AND created_at >= now() - interval '7 days') AS users_last_7_days,
      (SELECT COUNT(*)::text FROM roses WHERE created_at >= now() - interval '7 days') AS roses_last_7_days,
      (SELECT COUNT(*)::text FROM feedbacks WHERE created_at >= now() - interval '7 days') AS feedback_last_7_days,
      (SELECT MAX(created_at)::text FROM roses) AS latest_rose_at,
      (SELECT MAX(created_at)::text FROM feedbacks) AS latest_feedback_at
  `) as UsageStatsRow[];

  return normalizeUsageStats(rows[0] ?? {
    total_users: 0,
    total_roses: 0,
    public_roses: 0,
    private_roses: 0,
    total_likes: 0,
    total_feedback: 0,
    users_last_7_days: 0,
    roses_last_7_days: 0,
    feedback_last_7_days: 0,
    latest_rose_at: null,
    latest_feedback_at: null,
  });
}

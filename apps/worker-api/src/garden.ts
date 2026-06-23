import { neon } from "@neondatabase/serverless";

type Bindings = {
  DATABASE_URL?: string;
};

type GardenItem = {
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
};

type GardenResponse = {
  data: GardenItem[];
  total: number;
  page: number;
  per_page: number;
};

const VALID_COLORS = new Set(["red", "white", "yellow"]);

function clampPage(value: string | null): number {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.trunc(parsed));
}

function clampPerPage(value: string | null): number {
  const parsed = Number(value ?? "20");
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(100, Math.max(1, Math.trunc(parsed)));
}

export async function getGarden(env: Bindings, requestUrl: string): Promise<GardenResponse> {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const url = new URL(requestUrl);
  const page = clampPage(url.searchParams.get("page"));
  const perPage = clampPerPage(url.searchParams.get("per_page"));
  const color = url.searchParams.get("color");

  if (color && !VALID_COLORS.has(color)) {
    throw new Error(`Invalid color '${color}'. Must be one of: red, white, yellow`);
  }

  const offset = (page - 1) * perPage;
  const sql = neon(env.DATABASE_URL);

  const totalRows = color
    ? (await sql`
        SELECT COUNT(*)::text AS count
        FROM roses
        WHERE color = ${color} AND is_private = false
      `) as Array<{ count: string }>
    : (await sql`
        SELECT COUNT(*)::text AS count
        FROM roses
        WHERE is_private = false
      `) as Array<{ count: string }>;

  const total = Number(totalRows[0]?.count ?? "0");

  const rows = color
    ? (await sql`
        SELECT
          r.id::text AS id,
          r.color,
          r.gratitude,
          r.anxiety,
          r.hope,
          r.user_id::text AS user_id,
          u.nickname,
          COUNT(l.id)::int AS like_count,
          r.ai_reply,
          r.is_private,
          r.created_at::text AS created_at,
          r.recipient_nickname,
          (r.recipient_nickname IS NOT NULL) AS is_gift
        FROM roses r
        LEFT JOIN users u
          ON u.id = r.user_id
         AND u.deleted_at IS NULL
        LEFT JOIN likes l
          ON l.rose_id = r.id
        WHERE r.color = ${color}
          AND r.is_private = false
        GROUP BY r.id, u.nickname
        ORDER BY r.created_at DESC
        LIMIT ${perPage}
        OFFSET ${offset}
      `) as GardenItem[]
    : (await sql`
        SELECT
          r.id::text AS id,
          r.color,
          r.gratitude,
          r.anxiety,
          r.hope,
          r.user_id::text AS user_id,
          u.nickname,
          COUNT(l.id)::int AS like_count,
          r.ai_reply,
          r.is_private,
          r.created_at::text AS created_at,
          r.recipient_nickname,
          (r.recipient_nickname IS NOT NULL) AS is_gift
        FROM roses r
        LEFT JOIN users u
          ON u.id = r.user_id
         AND u.deleted_at IS NULL
        LEFT JOIN likes l
          ON l.rose_id = r.id
        WHERE r.is_private = false
        GROUP BY r.id, u.nickname
        ORDER BY r.created_at DESC
        LIMIT ${perPage}
        OFFSET ${offset}
      `) as GardenItem[];

  return {
    data: rows,
    total,
    page,
    per_page: perPage,
  };
}

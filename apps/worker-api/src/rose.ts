import { neon } from "@neondatabase/serverless";

type Bindings = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
};

type RoseRecord = {
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
  recipient_user_id: string | null;
  is_gift: boolean;
};

type RoseResponse = Omit<RoseRecord, "recipient_user_id">;

type JwtClaims = {
  sub?: string;
  exp?: number;
};

function base64UrlToArrayBuffer(input: string): ArrayBuffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = atob(padded);
  const view = Uint8Array.from(bytes, (char) => char.charCodeAt(0));
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function decodeJwtPayload(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = base64UrlToArrayBuffer(parts[1] ?? "");
    return JSON.parse(new TextDecoder().decode(payload)) as JwtClaims;
  } catch {
    return null;
  }
}

async function verifyJwt(token: string, secret: string): Promise<JwtClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, payload, signature] = parts;
  const data = new TextEncoder().encode(`${header}.${payload}`);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const valid = await crypto.subtle.verify("HMAC", key, base64UrlToArrayBuffer(signature ?? ""), data);
  if (!valid) {
    return null;
  }

  const claims = decodeJwtPayload(token);
  if (!claims?.sub) {
    return null;
  }
  if (typeof claims.exp === "number" && claims.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return claims;
}

export function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

export async function getUserIdFromRequest(request: Request, env: Bindings): Promise<string | null> {
  const token = extractBearerToken(request);
  if (!token || !env.JWT_SECRET) {
    return null;
  }

  const claims = await verifyJwt(token, env.JWT_SECRET);
  return claims?.sub ?? null;
}

export function canAccessRose(
  rose: Pick<RoseRecord, "is_private" | "user_id" | "recipient_user_id">,
  userId: string | null
): boolean {
  if (!rose.is_private) {
    return true;
  }

  if (!userId) {
    return false;
  }

  return rose.user_id === userId || rose.recipient_user_id === userId;
}

function toRoseResponse(rose: RoseRecord): RoseResponse {
  const { recipient_user_id: _recipientUserId, ...response } = rose;
  return response;
}

export async function getRose(env: Bindings, request: Request, roseId: string): Promise<RoseResponse> {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = neon(env.DATABASE_URL);
  const rows = (await sql`
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
      r.recipient_user_id::text AS recipient_user_id,
      (r.recipient_nickname IS NOT NULL) AS is_gift
    FROM roses r
    LEFT JOIN users u
      ON u.id = r.user_id
     AND u.deleted_at IS NULL
    LEFT JOIN likes l
      ON l.rose_id = r.id
    WHERE r.id = ${roseId}
    GROUP BY r.id, u.nickname
    LIMIT 1
  `) as RoseRecord[];

  const rose = rows[0];
  if (!rose) {
    throw new Error("ROSE_NOT_FOUND");
  }

  const userId = await getUserIdFromRequest(request, env);
  if (!canAccessRose(rose, userId)) {
    throw new Error("ROSE_NOT_FOUND");
  }

  return toRoseResponse(rose);
}

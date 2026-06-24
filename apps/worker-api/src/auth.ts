import { neon } from "@neondatabase/serverless";
import { extractBearerToken, getUserIdFromRequest } from "./rose.js";

type Bindings = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
};

type UserRow = {
  id: string;
  nickname: string;
};

type RefreshTokenRow = {
  user_id: string;
};

export type RefreshResponse = {
  access_token: string;
};

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function base64UrlEncode(bytes: Uint8Array): string {
  const text = String.fromCharCode(...bytes);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256(secret: string, content: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validateRefreshToken(token: string): boolean {
  return isUuidLike(token);
}

export async function parseRefreshRequest(request: Request): Promise<string> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new Error("invalid or expired refresh token");
  }

  const refreshToken =
    typeof body === "object" &&
    body !== null &&
    "refresh_token" in body &&
    typeof body.refresh_token === "string"
      ? body.refresh_token.trim()
      : "";

  if (!validateRefreshToken(refreshToken)) {
    throw new Error("invalid or expired refresh token");
  }

  return refreshToken;
}

async function createAccessToken(userId: string, nickname: string, secret: string): Promise<string> {
  const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        sub: userId,
        nickname,
        exp: Math.floor(Date.now() / 1000) + 15 * 60,
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  const signature = await hmacSha256(secret, signingInput);
  return `${signingInput}.${signature}`;
}

async function loadActiveUser(env: Bindings, userId: string): Promise<UserRow | null> {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const sql = neon(env.DATABASE_URL);
  const rows = (await sql`
    SELECT id::text AS id, nickname
    FROM users
    WHERE id = ${userId}
      AND deleted_at IS NULL
    LIMIT 1
  `) as UserRow[];

  return rows[0] ?? null;
}

export async function shouldRevokeByAccessToken(request: Request, env: Bindings): Promise<boolean> {
  if (!env.JWT_SECRET) {
    return false;
  }

  const userId = await getUserIdFromRequest(request, env);
  return Boolean(userId);
}

export async function refreshAccessToken(env: Bindings, request: Request): Promise<RefreshResponse> {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }

  const refreshToken = await parseRefreshRequest(request);
  const tokenHash = await hashRefreshToken(refreshToken);
  const sql = neon(env.DATABASE_URL);

  const tokenRows = (await sql`
    SELECT user_id::text AS user_id
    FROM refresh_tokens
    WHERE token_hash = ${tokenHash}
      AND revoked = false
      AND expires_at > now()
    LIMIT 1
  `) as RefreshTokenRow[];

  const tokenRow = tokenRows[0];
  if (!tokenRow) {
    throw new Error("invalid or expired refresh token");
  }

  const user = await loadActiveUser(env, tokenRow.user_id);
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    access_token: await createAccessToken(user.id, user.nickname, env.JWT_SECRET),
  };
}

export async function logoutUser(env: Bindings, request: Request): Promise<{ success: true }> {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const bearer = extractBearerToken(request);
  if (!bearer) {
    throw new Error("missing or invalid token");
  }

  const sql = neon(env.DATABASE_URL);

  if (await shouldRevokeByAccessToken(request, env)) {
    const userId = await getUserIdFromRequest(request, env);
    if (!userId) {
      throw new Error("missing or invalid token");
    }

    await sql`
      UPDATE refresh_tokens
      SET revoked = true
      WHERE user_id = ${userId}
    `;

    return { success: true };
  }

  const tokenHash = await hashRefreshToken(bearer);
  const result = (await sql`
    UPDATE refresh_tokens
    SET revoked = true
    WHERE token_hash = ${tokenHash}
    RETURNING user_id::text AS user_id
  `) as RefreshTokenRow[];

  if (result.length === 0) {
    throw new Error("missing or invalid token");
  }

  return { success: true };
}

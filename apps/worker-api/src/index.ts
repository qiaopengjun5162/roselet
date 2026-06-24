import { Hono } from "hono";
import { logoutUser, refreshAccessToken } from "./auth.js";
import { getGarden } from "./garden.js";
import { getRose } from "./rose.js";
import { getUsageStats } from "./stats.js";

type Bindings = {
  APP_NAME: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  ADMIN_USER_IDS?: string;
  ALLOWED_ORIGINS?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", async (c, next) => {
  const allowed = c.env.ALLOWED_ORIGINS ?? "*";
  c.header("Access-Control-Allow-Origin", allowed === "*" ? "*" : allowed.split(",")[0]?.trim() || "*");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }

  await next();
});

app.get("/health", (c) => {
  return c.json({
    ok: true,
    runtime: "cloudflare-workers",
    service: c.env.APP_NAME,
    database_configured: Boolean(c.env.DATABASE_URL),
    jwt_configured: Boolean(c.env.JWT_SECRET),
  });
});

app.get("/api/garden", async (c) => {
  try {
    const data = await getGarden(c.env, c.req.url);
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    const status = message.startsWith("Invalid color") ? 400 : 500;
    return c.json({ error: message }, status);
  }
});

app.get("/api/rose/:id", async (c) => {
  try {
    const data = await getRose(c.env, c.req.raw, c.req.param("id"));
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    const status = message === "ROSE_NOT_FOUND" ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

app.get("/api/stats", async (c) => {
  try {
    const data = await getUsageStats(c.env, c.req.raw);
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    const status = message === "STATS_UNAUTHORIZED" ? 401 : message === "STATS_FORBIDDEN" ? 403 : 500;
    return c.json({ error: message }, status);
  }
});

app.post("/api/auth/refresh", async (c) => {
  try {
    const data = await refreshAccessToken(c.env, c.req.raw);
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    const status = message === "invalid or expired refresh token" ? 401 : message === "USER_NOT_FOUND" ? 404 : 500;
    return c.json({ error: message }, status);
  }
});

app.post("/api/auth/logout", async (c) => {
  try {
    const data = await logoutUser(c.env, c.req.raw);
    return c.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器内部错误";
    const status = message === "missing or invalid token" ? 401 : 500;
    return c.json({ error: message }, status);
  }
});

app.notFound((c) => {
  return c.json(
    {
      error: "not_found",
      message: "Route not migrated to Cloudflare Worker yet",
    },
    404
  );
});

export default app;

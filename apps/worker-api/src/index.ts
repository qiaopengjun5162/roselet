import { Hono } from "hono";
import { getGarden } from "./garden";
import { getRose } from "./rose";

type Bindings = {
  APP_NAME: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
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

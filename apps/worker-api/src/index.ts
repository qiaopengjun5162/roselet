import { Hono } from "hono";

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

app.get("/api/garden", (c) => {
  return c.json({
    items: [],
    total: 0,
    source: "worker-placeholder",
    next_step: "migrate read-only garden API from Rust backend",
  });
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

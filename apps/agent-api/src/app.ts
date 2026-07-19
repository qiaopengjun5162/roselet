import { Hono, type MiddlewareHandler } from "hono";
import {
  type CleanedReflectionInput,
  generateReflectionFromCleanedInput,
  InvalidReflectionInput,
  validateReflectionInput,
} from "./reflection.js";

export interface CreateAppOptions {
  payment: MiddlewareHandler;
}

export function createApp({ payment }: CreateAppOptions) {
  const app = new Hono<{ Variables: { reflectionInput: CleanedReflectionInput } }>();

  app.get("/health", c => c.json({ status: "ok", paymentProtocol: "x402", network: "solana-devnet" }));
  app.use("/v1/reflection", async (c, next) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "request body must be valid JSON" }, 400);
    }

    try {
      c.set("reflectionInput", validateReflectionInput(body));
    } catch (error) {
      if (error instanceof InvalidReflectionInput) {
        return c.json({ error: error.code }, 400);
      }
      throw error;
    }

    await next();
  });
  app.use("/v1/reflection", payment);
  app.post("/v1/reflection", c =>
    c.json(generateReflectionFromCleanedInput(c.get("reflectionInput"))),
  );

  return app;
}

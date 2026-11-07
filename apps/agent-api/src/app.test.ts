import type { MiddlewareHandler } from "hono";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

const allowPayment: MiddlewareHandler = async (_c, next) => next();
const requirePayment: MiddlewareHandler = async c => c.json({ error: "payment required" }, 402);

describe("Agent API", () => {
  it("keeps health public", async () => {
    const response = await createApp({ payment: requirePayment }).request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      paymentProtocol: "x402",
      network: "solana-devnet",
    });
  });

  it("does not execute reflection without payment", async () => {
    const response = await createApp({ payment: requirePayment }).request("/v1/reflection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color: "red", gratitude: "thanks" }),
    });

    expect(response.status).toBe(402);
  });

  it("returns the Rust recommendation after payment middleware accepts", async () => {
    const response = await createApp({ payment: allowPayment }).request("/v1/reflection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color: "yellow", hope: "期待项目上线" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json() as { input: { hope: string }; recommendation: { theme: { title: string } } };
    expect(body.input.hope).toBe("期待项目上线");
    expect(body.recommendation.theme.title).toBeTruthy();
  });

  it("rejects malformed JSON and invalid input before requesting payment", async () => {
    const malformed = await createApp({ payment: requirePayment }).request("/v1/reflection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    expect(malformed.status).toBe(400);

    const invalid = await createApp({ payment: requirePayment }).request("/v1/reflection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color: "red" }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "empty_content" });
  });
});

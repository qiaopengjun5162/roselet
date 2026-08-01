import { describe, expect, it } from "vitest";
import { decodeBase64JsonHeader, withoutExplicitContentLength } from "./client-network.js";

describe("withoutExplicitContentLength", () => {
  it("lets Undici recalculate content length for proxied Solana RPC requests", () => {
    const result = withoutExplicitContentLength({
      method: "POST",
      headers: { "content-length": "123", "content-type": "application/json" },
      body: "{}",
    });
    const headers = new Headers(result?.headers);

    expect(headers.has("content-length")).toBe(false);
    expect(headers.get("content-type")).toBe("application/json");
    expect(result?.body).toBe("{}");
  });

  it("preserves requests without headers", () => {
    expect(withoutExplicitContentLength(undefined)).toBeUndefined();
    expect(withoutExplicitContentLength({ method: "GET" })).toEqual({ method: "GET" });
  });
});

describe("decodeBase64JsonHeader", () => {
  it("decodes public x402 diagnostics without failing on malformed headers", () => {
    const encoded = Buffer.from(JSON.stringify({ error: "payment_required" })).toString("base64");

    expect(decodeBase64JsonHeader(encoded)).toEqual({ error: "payment_required" });
    expect(decodeBase64JsonHeader("not-json")).toBe("invalid_base64_json");
    expect(decodeBase64JsonHeader(null)).toBeNull();
  });
});

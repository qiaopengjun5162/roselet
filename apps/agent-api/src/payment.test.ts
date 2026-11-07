import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { createReflectionPayment } from "./payment.js";

describe("createReflectionPayment", () => {
  it("constructs official x402 SVM middleware for Solana Devnet", () => {
    const config = loadConfig({
      X402_SVM_PAY_TO: "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4",
    });

    expect(createReflectionPayment(config, false)).toEqual(expect.any(Function));
  });
});

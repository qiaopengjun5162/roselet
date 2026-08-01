import { describe, expect, it } from "vitest";
import {
  DEFAULT_GOATX402_API_URL,
  DEFAULT_FACILITATOR_URL,
  DEFAULT_REFLECTION_PRICE,
  loadConfig,
  loadGoatConfig,
  SOLANA_DEVNET,
} from "./config.js";

const PAY_TO = "2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4";

describe("loadConfig", () => {
  it("uses safe Solana Devnet defaults", () => {
    expect(loadConfig({ X402_SVM_PAY_TO: PAY_TO })).toEqual({
      facilitatorUrl: DEFAULT_FACILITATOR_URL,
      host: "127.0.0.1",
      network: SOLANA_DEVNET,
      payTo: PAY_TO,
      port: 4021,
      price: DEFAULT_REFLECTION_PRICE,
    });
  });

  it("accepts explicit runtime values", () => {
    expect(loadConfig({
      X402_SVM_PAY_TO: PAY_TO,
      X402_FACILITATOR_URL: "https://facilitator.example",
      X402_REFLECTION_PRICE: "$0.25",
      AGENT_API_HOST: "0.0.0.0",
      AGENT_API_PORT: "4402",
    })).toMatchObject({
      facilitatorUrl: "https://facilitator.example",
      host: "0.0.0.0",
      price: "$0.25",
      port: 4402,
    });
  });

  it("rejects missing or unsafe payment configuration", () => {
    expect(() => loadConfig({})).toThrow("X402_SVM_PAY_TO is required");
    expect(() => loadConfig({ X402_SVM_PAY_TO: "invalid" })).toThrow();
    expect(() => loadConfig({ X402_SVM_PAY_TO: PAY_TO, AGENT_API_HOST: "localhost" })).toThrow("AGENT_API_HOST");
    expect(() => loadConfig({ X402_SVM_PAY_TO: PAY_TO, AGENT_API_PORT: "0" })).toThrow("valid TCP port");
    expect(() => loadConfig({ X402_SVM_PAY_TO: PAY_TO, X402_REFLECTION_PRICE: "free" })).toThrow("USD amount");
    expect(() => loadConfig({ X402_SVM_PAY_TO: PAY_TO, X402_REFLECTION_PRICE: "$0" })).toThrow("positive USD amount");
  });
});

describe("loadGoatConfig", () => {
  const GOAT_ENV = {
    GOATX402_MERCHANT_ID: "merchant-1",
    GOATX402_API_KEY: "key-1",
    GOATX402_API_SECRET: "secret-1",
    GOATX402_REFLECTION_AMOUNT_WEI: "1000",
  };

  it("returns null when GOAT is not configured", () => {
    expect(loadGoatConfig({})).toBeNull();
  });

  it("uses the official Testnet3 API by default", () => {
    expect(loadGoatConfig(GOAT_ENV)).toEqual({
      apiUrl: DEFAULT_GOATX402_API_URL,
      merchantId: "merchant-1",
      apiKey: "key-1",
      apiSecret: "secret-1",
      reflectionAmountWei: "1000",
    });
  });

  it("fails fast on partial configuration", () => {
    expect(() => loadGoatConfig({ GOATX402_MERCHANT_ID: "merchant-1" })).toThrow(
      "partial GOAT x402 configuration",
    );
    expect(() => loadGoatConfig({ ...GOAT_ENV, GOATX402_API_SECRET: "" })).toThrow(
      "GOATX402_API_SECRET",
    );
  });

  it("rejects a non-positive-integer reflection amount", () => {
    expect(() => loadGoatConfig({ ...GOAT_ENV, GOATX402_REFLECTION_AMOUNT_WEI: "0" })).toThrow(
      "positive integer",
    );
    expect(() => loadGoatConfig({ ...GOAT_ENV, GOATX402_REFLECTION_AMOUNT_WEI: "1.5" })).toThrow(
      "positive integer",
    );
  });
});

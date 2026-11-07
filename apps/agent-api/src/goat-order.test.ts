import { describe, expect, it } from "vitest";
import { buildGoatOrderReference, InvalidGoatOrderReference } from "./goat-order.js";

const INPUT = {
  reflection: { color: "red", gratitude: "thanks" },
  payer: "0x1111111111111111111111111111111111111111",
  chain_id: 48816,
  token_symbol: "USDC",
  token_contract: "0x2222222222222222222222222222222222222222",
  amount_wei: "1000",
};

describe("buildGoatOrderReference", () => {
  it("returns the Rust normalized reference", () => {
    const reference = buildGoatOrderReference(INPUT);

    expect(reference.dapp_order_id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(reference.payer).toBe(INPUT.payer);
    expect(reference.chain_id).toBe(48816);
    expect(reference.amount_wei).toBe("1000");
  });

  it("rejects invalid payment fields with a stable error", () => {
    expect(() => buildGoatOrderReference({ ...INPUT, payer: "bad" })).toThrow(
      InvalidGoatOrderReference,
    );
  });
});

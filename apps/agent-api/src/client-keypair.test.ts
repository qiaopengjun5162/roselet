import { describe, expect, it } from "vitest";
import { parseKeypairBytes } from "./client-keypair.js";

describe("parseKeypairBytes", () => {
  it("accepts a Solana CLI keypair array", () => {
    const bytes = Array.from({ length: 64 }, (_, index) => index);

    expect(parseKeypairBytes(bytes)).toEqual(Uint8Array.from(bytes));
  });

  it("rejects malformed or out-of-range key material", () => {
    expect(() => parseKeypairBytes([])).toThrow("64 bytes");
    expect(() => parseKeypairBytes([...Array(63).fill(0), 256])).toThrow("invalid byte");
  });
});

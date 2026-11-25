import { encodeBase58 } from "../base58";

describe("encodeBase58", () => {
  it("matches the base58btc test vector for 'hello world'", () => {
    const bytes = Uint8Array.from("hello world", (c) => c.charCodeAt(0));
    expect(encodeBase58(bytes)).toBe("StV1DL6CwTryKyV");
  });

  it("preserves leading zero bytes as '1' characters", () => {
    expect(encodeBase58(new Uint8Array([0]))).toBe("1");
    expect(encodeBase58(new Uint8Array([0, 0, 1]))).toBe("112");
  });

  it("returns an empty string for empty input", () => {
    expect(encodeBase58(new Uint8Array([]))).toBe("");
  });

  it("encodes a 64-byte signature to the expected length band", () => {
    const signature = new Uint8Array(64).fill(255);
    const encoded = encodeBase58(signature);
    // 64 bytes of 0xff ≈ 87–88 base58 chars, the band Solana RPC accepts.
    expect(encoded.length).toBeGreaterThanOrEqual(86);
    expect(encoded.length).toBeLessThanOrEqual(88);
  });
});

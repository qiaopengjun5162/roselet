const mockDecode = jest.fn();
const mockGetSignatureFromTransaction = jest.fn();
const mockGetBase64EncodedWireTransaction = jest.fn();
const mockSend = jest.fn();
const mockSendTransaction = jest.fn(() => ({ send: mockSend }));
const mockGetLatestBlockhashSend = jest.fn();
const mockGetLatestBlockhash = jest.fn(() => ({ send: mockGetLatestBlockhashSend }));
const mockRentSend = jest.fn();
const mockGetMinimumBalanceForRentExemption = jest.fn(() => ({ send: mockRentSend }));
const mockStatusesSend = jest.fn();
const mockGetSignatureStatuses = jest.fn(() => ({ send: mockStatusesSend }));
const mockHeightSend = jest.fn();
const mockGetBlockHeight = jest.fn(() => ({ send: mockHeightSend }));
const mockCreateSolanaRpc = jest.fn(() => ({
  sendTransaction: mockSendTransaction,
  getLatestBlockhash: mockGetLatestBlockhash,
  getMinimumBalanceForRentExemption: mockGetMinimumBalanceForRentExemption,
  getSignatureStatuses: mockGetSignatureStatuses,
  getBlockHeight: mockGetBlockHeight,
}));

// `loadKit()` uses a dynamic import, which ts-jest turns into a require of
// this module. Stubbing it keeps the test in jsdom (no TextEncoder/subtle
// crypto) while still pinning the exact kit factories we rely on.
jest.mock("@solana/kit", () => ({
  createSolanaRpc: mockCreateSolanaRpc,
  getTransactionDecoder: () => ({ decode: mockDecode }),
  getSignatureFromTransaction: mockGetSignatureFromTransaction,
  getBase64EncodedWireTransaction: mockGetBase64EncodedWireTransaction,
}));

import {
  confirmSignature,
  fetchBlockhash,
  fetchRentExemptionLamports,
  sendSignedTransaction,
} from "../solana-rpc";

describe("sendSignedTransaction", () => {
  // A stand-in for kit's decoded transaction object. The production code must
  // hand this *same* object to both factories — that is what guarantees the
  // signature we return belongs to the exact payload we broadcast.
  const wire = new Uint8Array([1, 2, 3]);
  const decoded = { signatures: {} };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDecode.mockReturnValue(decoded);
    mockGetSignatureFromTransaction.mockReturnValue("sig-from-wire");
    mockGetBase64EncodedWireTransaction.mockReturnValue("BASE64_WIRE==");
    mockSend.mockResolvedValue("sig-from-wire");
  });

  it("derives the RPC payload and the returned signature from the same wire bytes", async () => {
    const signature = await sendSignedTransaction(wire, {
      skipPreflight: true,
      maxRetries: 5,
    });

    expect(mockDecode).toHaveBeenCalledWith(wire);
    expect(mockGetSignatureFromTransaction).toHaveBeenCalledWith(decoded);
    expect(mockGetBase64EncodedWireTransaction).toHaveBeenCalledWith(decoded);
    expect(mockSendTransaction).toHaveBeenCalledWith("BASE64_WIRE==", {
      encoding: "base64",
      skipPreflight: true,
      maxRetries: 5n,
    });
    expect(signature).toBe("sig-from-wire");
  });

  it("passes each call site's preflight and retry options through", async () => {
    // The NFT path keeps preflight ON (a failed simulation is cheap); the memo
    // path turns it OFF. Both must reach the RPC unchanged.
    await sendSignedTransaction(wire, { skipPreflight: false, maxRetries: 2 });
    expect(mockSendTransaction).toHaveBeenCalledWith("BASE64_WIRE==", {
      encoding: "base64",
      skipPreflight: false,
      maxRetries: 2n,
    });
  });
});

describe("fetchBlockhash", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("asks for a finalized blockhash and unwraps the lifetime", async () => {
    mockGetLatestBlockhashSend.mockResolvedValue({
      value: { blockhash: "BH111", lastValidBlockHeight: 42n },
    });

    const lifetime = await fetchBlockhash();

    expect(mockGetLatestBlockhash).toHaveBeenCalledWith({ commitment: "finalized" });
    expect(lifetime).toEqual({ blockhash: "BH111", lastValidBlockHeight: 42n });
  });
});

describe("fetchRentExemptionLamports", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requests rent exemption for the account space in bytes", async () => {
    mockRentSend.mockResolvedValue(2_039_280n);

    await expect(fetchRentExemptionLamports(82)).resolves.toBe(2_039_280n);
    expect(mockGetMinimumBalanceForRentExemption).toHaveBeenCalledWith(82n);
  });
});

describe("confirmSignature", () => {
  const lifetime = { blockhash: "BH111" as never, lastValidBlockHeight: 42n };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns once the transaction is finalized", async () => {
    mockStatusesSend.mockResolvedValue({
      value: [{ err: null, confirmationStatus: "finalized" }],
    });

    await expect(confirmSignature("SIG", lifetime)).resolves.toBeUndefined();
    expect(mockGetSignatureStatuses).toHaveBeenCalledWith(["SIG" as never]);
  });

  it("throws with the on-chain error when the transaction failed", async () => {
    mockStatusesSend.mockResolvedValue({
      value: [{ err: { InstructionError: [0, "Custom"] }, confirmationStatus: "finalized" }],
    });

    await expect(confirmSignature("SIG", lifetime)).rejects.toThrow("链上交易执行失败");
  });

  it("polls again while the transaction is still only confirmed", async () => {
    mockStatusesSend
      .mockResolvedValueOnce({ value: [{ err: null, confirmationStatus: "confirmed" }] })
      .mockResolvedValueOnce({ value: [{ err: null, confirmationStatus: "finalized" }] });
    mockHeightSend.mockResolvedValue(40n);

    await expect(confirmSignature("SIG", lifetime, { pollMs: 1 })).resolves.toBeUndefined();
    expect(mockStatusesSend).toHaveBeenCalledTimes(2);
  });

  it("gives up as soon as the blockhash has expired", async () => {
    mockStatusesSend.mockResolvedValue({ value: [{ err: null, confirmationStatus: "confirmed" }] });
    mockHeightSend.mockResolvedValue(43n);

    await expect(confirmSignature("SIG", lifetime, { pollMs: 1 })).rejects.toThrow("交易已过期");
  });

  it("throws when waiting outlasts the timeout budget", async () => {
    mockStatusesSend.mockResolvedValue({ value: [null] });
    mockHeightSend.mockResolvedValue(40n);

    await expect(confirmSignature("SIG", lifetime, { timeoutMs: 0, pollMs: 1 })).rejects.toThrow(
      "等待链上最终确认超时",
    );
  });
});

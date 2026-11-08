const mockDecode = jest.fn();
const mockGetSignatureFromTransaction = jest.fn();
const mockGetBase64EncodedWireTransaction = jest.fn();
const mockSend = jest.fn();
const mockSendTransaction = jest.fn(() => ({ send: mockSend }));
const mockCreateSolanaRpc = jest.fn(() => ({
  sendTransaction: mockSendTransaction,
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

import { sendSignedTransaction } from "../solana-rpc";

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

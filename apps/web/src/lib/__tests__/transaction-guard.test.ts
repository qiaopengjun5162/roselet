import {
  type WireTransactionView,
  assertWalletPreservedTransaction,
  toWireTransactionView,
} from "../transaction-guard";

const MINT = "Mint1111111111111111111111111111111111111";
const WALLET = "Wallet11111111111111111111111111111111111";
const EXTRA = "Extra1111111111111111111111111111111111111";
const MESSAGE = new Uint8Array([1, 2, 3, 4]);
const MINT_SIG = new Uint8Array(64).fill(7);
const WALLET_SIG = new Uint8Array(64).fill(9);

const expectation = { requiredSigners: [MINT], walletAddress: WALLET };

function view(
  overrides: Partial<WireTransactionView> = {},
): WireTransactionView {
  return {
    messageBytes: Uint8Array.from(MESSAGE),
    signatures: { [MINT]: Uint8Array.from(MINT_SIG), [WALLET]: null },
    ...overrides,
  };
}

/** What a correct Wallet Standard wallet hands back: add a signature, keep all others. */
function correctlySigned(): WireTransactionView {
  return view({
    signatures: {
      [MINT]: Uint8Array.from(MINT_SIG),
      [WALLET]: Uint8Array.from(WALLET_SIG),
    },
  });
}

describe("assertWalletPreservedTransaction", () => {
  it("accepts a wallet that adds its signature and keeps the mint's", () => {
    expect(() =>
      assertWalletPreservedTransaction(view(), correctlySigned(), expectation),
    ).not.toThrow();
  });

  it("rejects a wallet that rebuilt / modified the message", () => {
    const after = correctlySigned();
    after.messageBytes[2] = 99;
    expect(() =>
      assertWalletPreservedTransaction(view(), after, expectation),
    ).toThrow(/与待签内容不同|未广播/);
  });

  it("rejects a wallet that dropped the mint signature", () => {
    const after = view({
      signatures: { [MINT]: null, [WALLET]: Uint8Array.from(WALLET_SIG) },
    });
    expect(() =>
      assertWalletPreservedTransaction(view(), after, expectation),
    ).toThrow(/mint 账户已附加的签名|未广播/);
  });

  it("rejects a wallet that changed the mint signature bytes", () => {
    const changed = Uint8Array.from(MINT_SIG);
    changed[0] = 8;
    const after = view({
      signatures: {
        [MINT]: changed,
        [WALLET]: Uint8Array.from(WALLET_SIG),
      },
    });
    expect(() =>
      assertWalletPreservedTransaction(view(), after, expectation),
    ).toThrow(/mint 账户已附加的签名/);
  });

  it("rejects a wallet that dropped any other pre-existing signature", () => {
    const before = view({
      signatures: {
        [MINT]: Uint8Array.from(MINT_SIG),
        [EXTRA]: new Uint8Array(64).fill(3),
        [WALLET]: null,
      },
    });
    const after = correctlySigned();
    expect(() =>
      assertWalletPreservedTransaction(before, after, expectation),
    ).toThrow(/丢弃了/);
  });

  it("allows a multisig wallet to ADD signatures", () => {
    const after = view({
      signatures: {
        [MINT]: Uint8Array.from(MINT_SIG),
        [WALLET]: Uint8Array.from(WALLET_SIG),
        [EXTRA]: new Uint8Array(64).fill(3),
      },
    });
    expect(() =>
      assertWalletPreservedTransaction(view(), after, expectation),
    ).not.toThrow();
  });

  it("rejects when the wallet never added the fee payer signature", () => {
    expect(() =>
      assertWalletPreservedTransaction(view(), view(), expectation),
    ).toThrow(/付款账户的签名|未广播/);
  });

  it("rejects when the locally-signed tx was already missing the mint", () => {
    const before = view({ signatures: { [MINT]: null, [WALLET]: null } });
    expect(() =>
      assertWalletPreservedTransaction(before, correctlySigned(), expectation),
    ).toThrow(/交给钱包前就缺少/);
  });
});

describe("toWireTransactionView", () => {
  it("normalizes kit-shaped decoded transactions, keeping null signatures", () => {
    const decoded = {
      messageBytes: new Uint8Array([5, 6]),
      signatures: { [MINT]: new Uint8Array([7, 8]), [WALLET]: null },
    };
    const result = toWireTransactionView(decoded);
    expect(result.messageBytes).toEqual(new Uint8Array([5, 6]));
    expect(result.signatures[MINT]).toEqual(new Uint8Array([7, 8]));
    expect(result.signatures[WALLET]).toBeNull();
    // Copies, not aliases — the guard must compare against a stable snapshot.
    expect(result.messageBytes).not.toBe(decoded.messageBytes);
  });

  it("fails loudly on an unexpected decoded shape", () => {
    expect(() => toWireTransactionView(null)).toThrow(/解码结果为空/);
    expect(() => toWireTransactionView({ messageBytes: "x" })).toThrow(
      /缺少 messageBytes/,
    );
    expect(() =>
      toWireTransactionView({
        messageBytes: new Uint8Array([1]),
        signatures: { [MINT]: "not-bytes" },
      }),
    ).toThrow(/签名格式异常/);
  });
});

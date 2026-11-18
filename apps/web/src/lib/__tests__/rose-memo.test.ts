/**
 * Unit coverage for the "轻量存证" memo transaction path.
 *
 * The membership panel test mocks `@/lib/rose-memo` wholesale, so the module
 * that actually builds the on-chain claim used to have no direct tests. This
 * matters most for the Memo program address: `@solana-program/memo` defaults
 * to Memo4c2pN8…, which is NOT in the backend's MEMO_PROGRAM_IDS whitelist.
 * The browser E2E caught that bug; these tests pin the override so it cannot
 * regress silently (the tx would land on-chain but server verification would
 * reject it).
 */

const WALLET = "8rUcGZLeSk6PCreV7LYGEoAxv1aiNPzxDCtoSUUTuHeG";
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const SIGNATURE = "5igNature1111111111111111111111111111111111111";
const WIRE = new Uint8Array([9, 8, 7]);
const SIGNED = new Uint8Array([9, 8, 7, 6]);
const LIFETIME = { blockhash: "BH", lastValidBlockHeight: 100n };
const CU_LIMIT = 20_000;

// A getter keeps the imported constant live so both the "priority fee set"
// and "priority fee unset" branches can be exercised without resetModules.
let mockPriorityFee = 50_000;

const mockGetAddMemo = jest.fn();
const mockSetCuLimit = jest.fn();
const mockSetCuPrice = jest.fn();
const mockLoadKit = jest.fn();
const mockFetchBlockhash = jest.fn();
const mockSend = jest.fn();
const mockAppend = jest.fn();
const mockEncode = jest.fn();

jest.mock("@/lib/solana", () => ({
  MEMO_COMPUTE_UNIT_LIMIT: 20_000,
  get PRIORITY_FEE_MICRO_LAMPORTS() {
    return mockPriorityFee;
  },
}));

jest.mock("@/lib/solana-rpc", () => ({
  loadKit: () => mockLoadKit(),
  fetchBlockhash: () => mockFetchBlockhash(),
  sendSignedTransaction: (...args: unknown[]) => mockSend(...args),
}));

jest.mock("@solana-program/memo", () => ({
  getAddMemoInstruction: (...args: unknown[]) => mockGetAddMemo(...args),
}));

jest.mock("@solana-program/compute-budget", () => ({
  getSetComputeUnitLimitInstruction: (...args: unknown[]) =>
    mockSetCuLimit(...args),
  getSetComputeUnitPriceInstruction: (...args: unknown[]) =>
    mockSetCuPrice(...args),
}));

import { MEMO_PROGRAM_ADDRESS, sendRoseMemo } from "../rose-memo";
import type { RoseMemoMeta, SendRoseMemoInput } from "../rose-memo";

const META: RoseMemoMeta = {
  app: "roselet",
  roseId: "rose-1",
  message: "愿你安好",
  imageCid: null,
  createdAt: "2026-11-14T00:00:00.000Z",
};

const kitStub = {
  address: (value: string) => value,
  createNoopSigner: (value: string) => ({ address: value }),
  pipe: (initial: unknown, ...fns: Array<(value: unknown) => unknown>) =>
    fns.reduce((value, fn) => fn(value), initial),
  createTransactionMessage: ({ version }: { version: number }) => ({ version }),
  setTransactionMessageFeePayerSigner: (signer: unknown, tx: object) => ({
    ...tx,
    feePayer: signer,
  }),
  setTransactionMessageLifetimeUsingBlockhash: (
    lifetime: unknown,
    tx: object,
  ) => ({ ...tx, lifetime }),
  appendTransactionMessageInstructions: (...args: unknown[]) =>
    mockAppend(...args),
  compileTransaction: (message: unknown) => ({ message }),
  getTransactionEncoder: () => ({ encode: mockEncode }),
};

function makeInput(
  overrides: Partial<SendRoseMemoInput> = {},
): SendRoseMemoInput & { signTransaction: jest.Mock; onStep: jest.Mock } {
  return {
    walletAddress: WALLET,
    meta: META,
    signTransaction: jest.fn(async () => SIGNED),
    onStep: jest.fn(),
    ...overrides,
  } as SendRoseMemoInput & { signTransaction: jest.Mock; onStep: jest.Mock };
}

function instructions(): unknown[] {
  return mockAppend.mock.calls[0][0] as unknown[];
}

describe("sendRoseMemo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPriorityFee = 50_000;
    mockLoadKit.mockResolvedValue(kitStub);
    mockFetchBlockhash.mockResolvedValue(LIFETIME);
    mockSend.mockResolvedValue(SIGNATURE);
    mockEncode.mockReturnValue(WIRE);
    mockAppend.mockImplementation((list: unknown, tx: object) => ({
      ...tx,
      instructions: list,
    }));
    mockGetAddMemo.mockImplementation((payload: unknown) => ({
      id: "memo",
      payload,
    }));
    mockSetCuLimit.mockImplementation((payload: unknown) => ({
      id: "cuLimit",
      payload,
    }));
    mockSetCuPrice.mockImplementation((payload: unknown) => ({
      id: "cuPrice",
      payload,
    }));
  });

  it("pins the canonical SPL Memo program instead of the SDK default", () => {
    expect(MEMO_PROGRAM_ADDRESS).toBe(MEMO_PROGRAM);
  });

  it("writes the payload verbatim and overrides the program address", async () => {
    await sendRoseMemo(makeInput());

    expect(mockGetAddMemo).toHaveBeenCalledTimes(1);
    const [payload, options] = mockGetAddMemo.mock.calls[0] as [
      { memo: string; signers: unknown[] },
      { programAddress: string },
    ];

    expect(JSON.parse(payload.memo)).toEqual(META);
    expect(JSON.parse(payload.memo).app).toBe("roselet");
    expect(payload.signers).toEqual([{ address: WALLET }]);
    // Regression guard: without this override the SDK uses Memo4c2pN8… and
    // the backend whitelist rejects an otherwise valid on-chain transaction.
    expect(options.programAddress).toBe(MEMO_PROGRAM_ADDRESS);
    expect(options.programAddress).not.toMatch(/^Memo4c2pN8/);
  });

  it("caps the compute-unit limit BEFORE setting the price, then adds the memo", async () => {
    await sendRoseMemo(makeInput());

    expect(mockSetCuLimit).toHaveBeenCalledWith({ units: CU_LIMIT });
    expect(mockSetCuPrice).toHaveBeenCalledWith({
      microLamports: mockPriorityFee,
    });
    const list = instructions();
    expect(list).toHaveLength(3);
    expect(list.map((i) => (i as { id: string }).id)).toEqual([
      "cuLimit",
      "cuPrice",
      "memo",
    ]);
  });

  it("omits compute-budget instructions when no priority fee is configured", async () => {
    mockPriorityFee = 0;
    await sendRoseMemo(makeInput());

    expect(mockSetCuLimit).not.toHaveBeenCalled();
    expect(mockSetCuPrice).not.toHaveBeenCalled();
    expect(instructions()).toHaveLength(1);
    expect((instructions()[0] as { id: string }).id).toBe("memo");
  });

  it("builds a v0 message with the wallet as fee payer and the fetched blockhash", async () => {
    await sendRoseMemo(makeInput());

    const [, message] = mockAppend.mock.calls[0] as [unknown, object];
    expect(message).toMatchObject({
      version: 0,
      feePayer: { address: WALLET },
      lifetime: LIFETIME,
    });
    expect(mockFetchBlockhash).toHaveBeenCalledTimes(1);
  });

  it("signs the encoded wire bytes and broadcasts with preflight skipped", async () => {
    const input = makeInput();
    await sendRoseMemo(input);

    expect(mockEncode).toHaveBeenCalledTimes(1);
    expect(input.signTransaction).toHaveBeenCalledWith(WIRE);
    expect(mockSend).toHaveBeenCalledWith(SIGNED, {
      skipPreflight: true,
      maxRetries: 5,
    });
  });

  it("reports progress in order and returns signature, lifetime and meta", async () => {
    const onStep = jest.fn();
    const result = await sendRoseMemo(makeInput({ onStep }));

    expect(onStep.mock.calls.map((call) => String(call[0]))).toEqual([
      "① 准备交易…",
      "② 等待钱包签名…",
      "③ 广播交易…",
    ]);
    expect(result).toEqual({ signature: SIGNATURE, lifetime: LIFETIME, meta: META });
  });

  it("works without an onStep callback", async () => {
    await expect(
      sendRoseMemo({
        walletAddress: WALLET,
        meta: META,
        signTransaction: jest.fn(async () => SIGNED),
      }),
    ).resolves.toMatchObject({ signature: SIGNATURE });
  });

  it("propagates wallet rejection and never broadcasts", async () => {
    const input = makeInput({
      signTransaction: jest.fn(async () => {
        throw new Error("user rejected");
      }),
    });

    await expect(sendRoseMemo(input)).rejects.toThrow("user rejected");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("propagates a broadcast failure instead of reporting success", async () => {
    mockSend.mockRejectedValueOnce(new Error("RPC rejected"));

    await expect(sendRoseMemo(makeInput())).rejects.toThrow("RPC rejected");
  });
});

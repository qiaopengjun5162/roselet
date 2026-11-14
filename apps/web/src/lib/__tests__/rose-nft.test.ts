/**
 * Unit coverage for the browser-side NFT mint orchestration.
 *
 * The component test mocks `@/lib/rose-nft` wholesale, so this module used to
 * ship with essentially zero unit coverage even though it owns the app's most
 * irreversible action (creating a ~0.004 SOL asset). Here we stub the lazily
 * imported SDKs and exercise the real orchestration: rent sizing, the full
 * instruction set, the wallet-signature guard, broadcast options and the
 * "finality timeout is not a failure" rule.
 */

const MINT = "Dhs11iijzktgppnv8aUa9fn9eosSjxxhpzyYuChF5DRv";
const WALLET = "8rUcGZLeSk6PCreV7LYGEoAxv1aiNPzxDCtoSUUTuHeG";
const ATA = "Ata1111111111111111111111111111111111111111";
const SIGNATURE = "5igNature1111111111111111111111111111111111111";

const WIRE = new Uint8Array([1, 2, 3]);
const SIGNED = new Uint8Array([1, 2, 3, 4]);

const mockBuildRoseNftFields = jest.fn();
const mockLoadKit = jest.fn();
const mockFetchRent = jest.fn();
const mockFetchBlockhash = jest.fn();
const mockSend = jest.fn();
const mockConfirm = jest.fn();
const mockToWireView = jest.fn();
const mockAssertPreserved = jest.fn();
const mockDecode = jest.fn();
const mockExtension = jest.fn();
const mockGetMintSize = jest.fn();
const mockFindAta = jest.fn();
const mockUpdateField = jest.fn();
const mockGenerateKeyPairSigner = jest.fn();
const mockEncode = jest.fn();
const mockPartiallySign = jest.fn();
const mockAppendInstructions = jest.fn();

jest.mock("@/lib/solana", () => ({
  buildRoseNftFields: (...args: unknown[]) => mockBuildRoseNftFields(...args),
}));

jest.mock("@/lib/solana-rpc", () => ({
  loadKit: () => mockLoadKit(),
  fetchRentExemptionLamports: (...args: unknown[]) => mockFetchRent(...args),
  fetchBlockhash: () => mockFetchBlockhash(),
  sendSignedTransaction: (...args: unknown[]) => mockSend(...args),
  confirmSignature: (...args: unknown[]) => mockConfirm(...args),
}));

jest.mock("@/lib/transaction-guard", () => ({
  toWireTransactionView: (...args: unknown[]) => mockToWireView(...args),
  assertWalletPreservedTransaction: (...args: unknown[]) =>
    mockAssertPreserved(...args),
}));

// ts-jest turns the lazy `import("@solana-program/...")` into a require, so
// these stubs keep the test in jsdom (no TextEncoder / subtle crypto needed).
jest.mock("@solana-program/token-2022", () => ({
  extension: (...args: unknown[]) => mockExtension(...args),
  getMintSize: (...args: unknown[]) => mockGetMintSize(...args),
  findAssociatedTokenPda: (...args: unknown[]) => mockFindAta(...args),
  TOKEN_2022_PROGRAM_ADDRESS:
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  getInitializeMetadataPointerInstruction: jest.fn(() => ({ id: "pointer" })),
  getInitializeMint2Instruction: jest.fn(() => ({ id: "initMint" })),
  getInitializeTokenMetadataInstruction: jest.fn(() => ({ id: "initMeta" })),
  getUpdateTokenMetadataFieldInstruction: (...args: unknown[]) =>
    mockUpdateField(...args),
  getCreateAssociatedTokenInstruction: jest.fn(() => ({ id: "createAta" })),
  getMintToInstruction: jest.fn(() => ({ id: "mintTo" })),
  getSetAuthorityInstruction: jest.fn(() => ({ id: "setAuthority" })),
  tokenMetadataField: jest.fn((kind: string, value: unknown[]) => ({
    kind,
    value,
  })),
  AuthorityType: { MintTokens: "MintTokens" },
}));

jest.mock("@solana-program/system", () => ({
  getCreateAccountInstruction: jest.fn(() => ({ id: "createAccount" })),
}));

import { mintRoseNft } from "../rose-nft";
import type { MintRoseNftInput } from "../rose-nft";

const FIELDS = {
  name: "愿这朵玫瑰在链上永远盛开",
  symbol: "ROSE",
  uri: "https://roselet.example/rose/rose-1",
  additionalMetadata: [
    ["roseId", "rose-1"],
    ["message", "愿你安好"],
  ] as Array<[string, string]>,
};

const LIFETIME = { blockhash: "BH", lastValidBlockHeight: 100n };

const kitStub = {
  generateKeyPairSigner: (...args: unknown[]) =>
    mockGenerateKeyPairSigner(...args),
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
    mockAppendInstructions(...args),
  partiallySignTransactionMessageWithSigners: (...args: unknown[]) =>
    mockPartiallySign(...args),
  getTransactionEncoder: () => ({ encode: mockEncode }),
  getTransactionDecoder: () => ({ decode: mockDecode }),
};

function makeInput(overrides: Partial<MintRoseNftInput> = {}) {
  return {
    walletAddress: WALLET,
    roseId: "rose-1",
    roseName: "愿你安好",
    imageCid: "bafyCid",
    signTransaction: jest.fn(async () => SIGNED),
    onStep: jest.fn(),
    ...overrides,
  };
}

describe("mintRoseNft", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockBuildRoseNftFields.mockReturnValue(FIELDS);
    mockLoadKit.mockResolvedValue(kitStub);
    mockGenerateKeyPairSigner.mockResolvedValue({ address: MINT });
    mockFetchBlockhash.mockResolvedValue(LIFETIME);
    mockFetchRent.mockResolvedValue(4_780_120n);
    mockFindAta.mockResolvedValue([ATA]);
    // Initial size (MetadataPointer only) vs final size (+TokenMetadata):
    // the account must be funded for the FINAL size, per the Devnet finding.
    mockGetMintSize.mockImplementation((extensions: unknown[]) =>
      extensions.length === 1 ? 300 : 513,
    );
    mockExtension.mockImplementation((type: string, args: unknown) => ({
      type,
      args,
    }));
    mockUpdateField.mockReturnValue({ id: "updateField" });
    mockAppendInstructions.mockImplementation(
      (instructions: unknown, tx: object) => ({ ...tx, instructions }),
    );
    mockPartiallySign.mockImplementation(async (message: unknown) => message);
    mockEncode.mockReturnValue(WIRE);
    mockDecode.mockImplementation((wire: Uint8Array) => ({ wire }));
    mockToWireView.mockImplementation((decoded: unknown) => decoded);
    mockAssertPreserved.mockImplementation(() => undefined);
    mockSend.mockResolvedValue(SIGNATURE);
    mockConfirm.mockResolvedValue(undefined);
  });

  it("funds for the final mint size and builds the whole NFT in one transaction", async () => {
    const input = makeInput();
    await mintRoseNft(input);

    expect(mockBuildRoseNftFields).toHaveBeenCalledWith({
      roseId: "rose-1",
      roseName: "愿你安好",
      imageCid: "bafyCid",
    });
    expect(mockGetMintSize).toHaveBeenCalledTimes(2);
    // Rent must be paid for the grown account, not the initial allocation.
    expect(mockFetchRent).toHaveBeenCalledWith(513);
    expect(mockFindAta).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: WALLET,
        mint: MINT,
      }),
    );
    expect(mockExtension).toHaveBeenCalledWith(
      "MetadataPointer",
      expect.objectContaining({ authority: WALLET, metadataAddress: MINT }),
    );
    expect(mockExtension).toHaveBeenCalledWith(
      "TokenMetadata",
      expect.objectContaining({
        updateAuthority: WALLET,
        name: FIELDS.name,
        symbol: FIELDS.symbol,
        uri: FIELDS.uri,
      }),
    );

    // 7 fixed instructions + one per additionalMetadata field (2).
    const [instructions] = mockAppendInstructions.mock.calls[0] as [
      unknown[],
      object,
    ];
    expect(instructions).toHaveLength(9);
    expect(mockUpdateField).toHaveBeenCalledTimes(2);
    expect(mockUpdateField).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: MINT, value: "rose-1" }),
    );
    expect(mockPartiallySign).toHaveBeenCalledTimes(1);
    expect(mockEncode).toHaveBeenCalledTimes(1);
    expect(input.signTransaction).toHaveBeenCalledWith(WIRE);
  });

  it("guards the wallet-returned transaction before broadcasting", async () => {
    const input = makeInput();
    await mintRoseNft(input);

    expect(mockAssertPreserved).toHaveBeenCalledWith(
      expect.objectContaining({ wire: WIRE }),
      expect.objectContaining({ wire: SIGNED }),
      { requiredSigners: [MINT], walletAddress: WALLET },
    );
    // NFT path keeps preflight ON (a rejected simulation costs nothing).
    expect(mockSend).toHaveBeenCalledWith(SIGNED, {
      skipPreflight: false,
      maxRetries: 5,
    });
    expect(mockConfirm).toHaveBeenCalledWith(SIGNATURE, LIFETIME);
  });

  it("reports progress in order and returns the on-chain identity", async () => {
    const onStep = jest.fn();
    const input = makeInput({ onStep });
    const result = await mintRoseNft(input);

    const steps = onStep.mock.calls.map((call) => String(call[0]));
    expect(steps).toHaveLength(5);
    expect(steps[0]).toContain("生成 mint 密钥对");
    expect(steps[1]).toContain("读取租金");
    expect(steps[2]).toContain("等待钱包签名");
    expect(steps[3]).toContain("广播交易");
    expect(steps[4]).toContain("最终确认");
    expect(result).toEqual({
      mintAddress: MINT,
      signature: SIGNATURE,
      name: FIELDS.name,
      uri: FIELDS.uri,
    });
  });

  it("works without an onStep callback", async () => {
    await expect(mintRoseNft(makeInput({ onStep: undefined }))).resolves.toEqual(
      expect.objectContaining({ mintAddress: MINT }),
    );
  });

  it("refuses to broadcast when the wallet's transaction cannot be decoded", async () => {
    mockDecode.mockImplementation(() => {
      throw new Error("invalid wire");
    });

    await expect(mintRoseNft(makeInput())).rejects.toThrow(
      /钱包返回的交易无法解析.*未广播、未扣费/,
    );
    expect(mockAssertPreserved).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("refuses to broadcast when the wallet modified the transaction", async () => {
    mockAssertPreserved.mockImplementation(() => {
      throw new Error("messageBytes changed");
    });

    await expect(mintRoseNft(makeInput())).rejects.toThrow(
      "messageBytes changed",
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("translates a missing-signature broadcast failure into actionable Chinese copy", async () => {
    mockSend.mockRejectedValueOnce(
      new Error("missing signature for signer"),
    );

    await expect(mintRoseNft(makeInput())).rejects.toThrow(
      /钱包没有保留 mint 账户的签名.*未广播（未扣费）/,
    );
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("rethrows unrelated RPC failures unchanged", async () => {
    mockSend.mockRejectedValueOnce(new Error("rpc unavailable"));

    await expect(mintRoseNft(makeInput())).rejects.toThrow("rpc unavailable");
  });

  it("treats a finality timeout as success and never offers a second mint", async () => {
    mockConfirm.mockRejectedValueOnce(new Error("confirmation timeout"));
    const onStep = jest.fn();
    const input = makeInput({ onStep });

    // A timeout must NOT throw: the tx is already broadcast, and throwing
    // would make the UI offer a retry that creates a SECOND NFT.
    const result = await mintRoseNft(input);

    expect(result.signature).toBe(SIGNATURE);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const steps = onStep.mock.calls.map((call) => String(call[0]));
    expect(steps[steps.length - 1]).toContain("仍在等待最终确认");
  });
});

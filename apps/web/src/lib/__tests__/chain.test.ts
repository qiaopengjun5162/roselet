/**
 * Unit coverage for the Base Sepolia memorial mint path.
 *
 * The component test mocks `@/lib/chain` wholesale, leaving the real module
 * untested. These tests pin the two encoding contracts the backend verifies
 * in the RoseMemorialMinted event: roseId -> bytes32 and colour -> uint8.
 * A drift there would produce a transaction that succeeds on-chain but is
 * rejected by the server.
 */

const CONTRACT = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";
const TX_HASH = "0xabc123";
const ROSE_ID = "550e8400-e29b-41d4-a716-446655440000";
const ROSE_ID_HEX = "0x550e8400e29b41d4a716446655440000";

const mockIsAddress = jest.fn();
const mockPadHex = jest.fn();
const mockCreateWalletClient = jest.fn();
const mockCreatePublicClient = jest.fn();
const mockCustom = jest.fn();
const mockHttp = jest.fn();
const mockRequestAddresses = jest.fn();
const mockSwitchChain = jest.fn();
const mockWriteContract = jest.fn();
const mockWaitForReceipt = jest.fn();

jest.mock("viem", () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
  createWalletClient: (...args: unknown[]) => mockCreateWalletClient(...args),
  custom: (...args: unknown[]) => mockCustom(...args),
  http: (...args: unknown[]) => mockHttp(...args),
  isAddress: (...args: unknown[]) => mockIsAddress(...args),
  padHex: (...args: unknown[]) => mockPadHex(...args),
  parseAbi: () => ["function mint(...) returns (uint256)"],
}));

jest.mock("viem/chains", () => ({ baseSepolia: { id: 84532 } }));

import { baseSepoliaTransactionUrl, mintRoseMemorial } from "../chain";

const originalContract = process.env.NEXT_PUBLIC_ROSE_MEMORIAL_CONTRACT_ADDRESS;

function setEthereum(value: unknown) {
  Object.defineProperty(window, "ethereum", {
    value,
    configurable: true,
    writable: true,
  });
}

describe("mintRoseMemorial", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_ROSE_MEMORIAL_CONTRACT_ADDRESS = CONTRACT;
    setEthereum({ request: jest.fn() });

    mockIsAddress.mockReturnValue(true);
    mockPadHex.mockImplementation((value: string) => value);
    mockCreateWalletClient.mockReturnValue({
      requestAddresses: mockRequestAddresses,
      switchChain: mockSwitchChain,
      writeContract: mockWriteContract,
    });
    mockCreatePublicClient.mockReturnValue({
      waitForTransactionReceipt: mockWaitForReceipt,
    });
    mockRequestAddresses.mockResolvedValue([WALLET]);
    mockWriteContract.mockResolvedValue(TX_HASH);
    mockWaitForReceipt.mockResolvedValue({ status: "success" });
    mockCustom.mockImplementation((provider: unknown) => ({ provider }));
    mockHttp.mockImplementation((url: unknown) => ({ url }));
  });

  afterAll(() => {
    if (originalContract === undefined) {
      delete process.env.NEXT_PUBLIC_ROSE_MEMORIAL_CONTRACT_ADDRESS;
    } else {
      process.env.NEXT_PUBLIC_ROSE_MEMORIAL_CONTRACT_ADDRESS = originalContract;
    }
  });

  it("mints on Base Sepolia and waits for one confirmation", async () => {
    const result = await mintRoseMemorial(ROSE_ID, "red", "愿你安好");

    expect(result).toEqual({ txHash: TX_HASH, walletAddress: WALLET });
    expect(mockCreateWalletClient).toHaveBeenCalledWith(
      expect.objectContaining({ chain: { id: 84532 } }),
    );
    expect(mockSwitchChain).toHaveBeenCalledWith({ id: 84532 });
    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CONTRACT,
        functionName: "mint",
        account: WALLET,
        args: [ROSE_ID_HEX, "愿你安好", 0],
      }),
    );
    expect(mockWaitForReceipt).toHaveBeenCalledWith({
      hash: TX_HASH,
      confirmations: 1,
    });
  });

  it.each([
    ["red", 0],
    ["white", 1],
    ["yellow", 2],
  ])("maps %s to colour index %i", async (color, index) => {
    await mintRoseMemorial(ROSE_ID, color, "message");

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        args: [ROSE_ID_HEX, "message", index],
      }),
    );
  });

  it("strips UUID dashes and pads the rose id to exactly 32 bytes", async () => {
    await mintRoseMemorial(ROSE_ID, "red", "message");

    expect(mockPadHex).toHaveBeenCalledWith(ROSE_ID_HEX, { size: 32 });
  });

  it("requires a wallet extension before doing anything", async () => {
    setEthereum(undefined);

    await expect(mintRoseMemorial(ROSE_ID, "red", "message")).rejects.toThrow(
      "请先安装或打开钱包扩展",
    );
    expect(mockCreateWalletClient).not.toHaveBeenCalled();
  });

  it("rejects when the wallet returns no account", async () => {
    mockRequestAddresses.mockResolvedValueOnce([]);

    await expect(mintRoseMemorial(ROSE_ID, "red", "message")).rejects.toThrow(
      "没有可用的钱包账户",
    );
    expect(mockWriteContract).not.toHaveBeenCalled();
  });

  it("rejects a missing or malformed contract address", async () => {
    delete process.env.NEXT_PUBLIC_ROSE_MEMORIAL_CONTRACT_ADDRESS;
    await expect(mintRoseMemorial(ROSE_ID, "red", "message")).rejects.toThrow(
      "链上纪念版尚未配置",
    );

    process.env.NEXT_PUBLIC_ROSE_MEMORIAL_CONTRACT_ADDRESS = CONTRACT;
    mockIsAddress.mockReturnValue(false);
    await expect(mintRoseMemorial(ROSE_ID, "red", "message")).rejects.toThrow(
      "链上纪念版尚未配置",
    );
    expect(mockWriteContract).not.toHaveBeenCalled();
  });

  it("rejects an unsupported colour", async () => {
    await expect(
      mintRoseMemorial(ROSE_ID, "purple", "message"),
    ).rejects.toThrow("不支持的玫瑰颜色");
    expect(mockWriteContract).not.toHaveBeenCalled();
  });

  it("rejects a rose id that is not 32 hex digits", async () => {
    await expect(
      mintRoseMemorial("not-a-uuid", "red", "message"),
    ).rejects.toThrow("无效的玫瑰编号");
    expect(mockPadHex).not.toHaveBeenCalled();
    expect(mockWriteContract).not.toHaveBeenCalled();
  });

  it("propagates a failed receipt instead of claiming success", async () => {
    mockWaitForReceipt.mockRejectedValueOnce(new Error("reverted"));

    await expect(mintRoseMemorial(ROSE_ID, "red", "message")).rejects.toThrow(
      "reverted",
    );
  });

  it("builds the Base Sepolia explorer URL", () => {
    expect(baseSepoliaTransactionUrl(TX_HASH)).toBe(
      `https://sepolia.basescan.org/tx/${TX_HASH}`,
    );
  });
});

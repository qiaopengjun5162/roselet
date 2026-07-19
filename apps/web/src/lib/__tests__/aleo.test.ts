const mockCreateTransaction = jest.fn();

jest.mock("@demox-labs/aleo-wallet-adapter-base", () => ({
  Transaction: {
    createTransaction: (...args: unknown[]) => mockCreateTransaction(...args),
  },
  WalletAdapterNetwork: {
    Testnet: "testnet",
  },
}));

const inputs = {
  rose_id: "1field",
  content_commitment: "2field",
  ai_reply_commitment: "3field",
  share_key: "4field",
};

describe("Aleo transactions", () => {
  const originalProgramId = process.env.NEXT_PUBLIC_ALEO_VAULT_PROGRAM_ID;
  const originalFee = process.env.NEXT_PUBLIC_ALEO_EXECUTION_FEE_MICROCREDITS;

  beforeEach(() => {
    jest.resetModules();
    mockCreateTransaction.mockReset();
    mockCreateTransaction.mockReturnValue({ id: "wallet-request" });
    process.env.NEXT_PUBLIC_ALEO_VAULT_PROGRAM_ID = "roselet_private_vault_test.aleo";
    process.env.NEXT_PUBLIC_ALEO_EXECUTION_FEE_MICROCREDITS = "125000";
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_ALEO_VAULT_PROGRAM_ID = originalProgramId;
    process.env.NEXT_PUBLIC_ALEO_EXECUTION_FEE_MICROCREDITS = originalFee;
  });

  it("builds a Testnet private rose execution with field-only inputs", async () => {
    const { createPrivateRoseTransaction } = await import("../aleo");

    expect(createPrivateRoseTransaction("aleo1owner", inputs)).toEqual({ id: "wallet-request" });
    expect(mockCreateTransaction).toHaveBeenCalledWith(
      "aleo1owner",
      "testnet",
      "roselet_private_vault_test.aleo",
      "plant_private_rose",
      ["1field", "2field", "3field", "4field"],
      125000,
    );
  });

  it.each(["0", "-1", "1.5", "not-a-number"])("rejects invalid execution fee %s", async (fee) => {
    process.env.NEXT_PUBLIC_ALEO_EXECUTION_FEE_MICROCREDITS = fee;
    const { createPrivateRoseTransaction } = await import("../aleo");

    expect(() => createPrivateRoseTransaction("aleo1owner", inputs)).toThrow("Aleo 执行费用配置无效");
    expect(mockCreateTransaction).not.toHaveBeenCalled();
  });
});

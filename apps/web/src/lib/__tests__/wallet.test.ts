import { getWallets } from "@wallet-standard/app";

import { listSolanaWallets, solanaChainForCluster } from "../wallet";

// The real registry reads browser globals; these tests only need its wallet
// list, so the registry is the single thing we stub.
jest.mock("@wallet-standard/app", () => ({
  getWallets: jest.fn(),
}));

const mockGetWallets = getWallets as jest.MockedFunction<typeof getWallets>;

describe("Wallet Standard chain ids", () => {
  it("maps each configured cluster to the chain id wallets sign for", () => {
    expect(solanaChainForCluster("devnet")).toBe("solana:devnet");
    expect(solanaChainForCluster("mainnet-beta")).toBe("solana:mainnet");
    // A custom RPC is deliberately reported as mainnet: telling a wallet it
    // is on devnet when real SOL is at stake would produce a valid-looking
    // signature for the wrong network.
    expect(solanaChainForCluster("custom")).toBe("solana:mainnet");
  });
});

describe("listSolanaWallets", () => {
  it("keeps only wallets that declare a solana: chain", () => {
    mockGetWallets.mockReturnValue({
      get: () => [
        { name: "Phantom", chains: ["solana:mainnet", "solana:devnet"] },
        { name: "MetaMask", chains: ["eip155:1"] },
      ],
    } as never);

    expect(listSolanaWallets().map((w) => w.name)).toEqual(["Phantom"]);
  });

  it("returns an empty list when no wallet is installed", () => {
    mockGetWallets.mockReturnValue({ get: () => [] } as never);
    expect(listSolanaWallets()).toEqual([]);
  });
});

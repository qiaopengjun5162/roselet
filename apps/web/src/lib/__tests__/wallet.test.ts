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

describe("connectSolanaWallet selection", () => {
  // A standard wallet with the two features connectSolanaWallet uses.
  function wallet(name: string) {
    return {
      name,
      chains: ["solana:devnet"],
      features: {
        "standard:connect": { connect: jest.fn().mockResolvedValue({
          accounts: [{ address: `${name}-addr`, chains: ["solana:devnet"] }],
        }) },
        "solana:signTransaction": { signTransaction: jest.fn() },
        "standard:disconnect": { disconnect: jest.fn() },
      },
    };
  }

  it("connects the wallet chosen by name, not the first one", async () => {
    const { connectSolanaWallet } = await import("../wallet");
    const phantom = wallet("Phantom");
    const solflare = wallet("Solflare");
    mockGetWallets.mockReturnValue({ get: () => [phantom, solflare] } as never);

    const session = await connectSolanaWallet("Solflare");

    expect(solflare.features["standard:connect"].connect).toHaveBeenCalledTimes(1);
    expect(phantom.features["standard:connect"].connect).not.toHaveBeenCalled();
    expect(session.address).toBe("Solflare-addr");
  });

  it("keeps the old Phantom-first behaviour when no name is given", async () => {
    const { connectSolanaWallet } = await import("../wallet");
    const solflare = wallet("Solflare");
    const phantom = wallet("Phantom");
    mockGetWallets.mockReturnValue({ get: () => [solflare, phantom] } as never);

    await connectSolanaWallet();

    expect(phantom.features["standard:connect"].connect).toHaveBeenCalledTimes(1);
    expect(solflare.features["standard:connect"].connect).not.toHaveBeenCalled();
  });

  it("passes silent:true to the wallet for auto-reconnect", async () => {
    const { connectSolanaWallet } = await import("../wallet");
    const phantom = wallet("Phantom");
    mockGetWallets.mockReturnValue({ get: () => [phantom] } as never);

    await connectSolanaWallet("Phantom", { silent: true });

    expect(phantom.features["standard:connect"].connect).toHaveBeenCalledWith({ silent: true });
  });

  it("keeps a normal connect parameter-free (no silent popup suppression)", async () => {
    const { connectSolanaWallet } = await import("../wallet");
    const phantom = wallet("Phantom");
    mockGetWallets.mockReturnValue({ get: () => [phantom] } as never);

    await connectSolanaWallet("Phantom");

    expect(phantom.features["standard:connect"].connect).toHaveBeenCalledWith(undefined);
  });
});

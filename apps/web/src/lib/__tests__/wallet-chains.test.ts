import {
  ALEO_WALLET_OPTIONS,
  INSTALL_LINKS,
  WALLET_CHAINS,
  chainMeta,
  shortWalletAddress,
  toWalletOptions,
} from "../wallet-chains";

describe("wallet chain registry", () => {
  it("declares every chain exactly once, with a purpose and a connect mode", () => {
    const ids = WALLET_CHAINS.map((chain) => chain.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const chain of WALLET_CHAINS) {
      expect(chain.label.length).toBeGreaterThan(0);
      expect(chain.purpose.length).toBeGreaterThan(0);
      expect(["inline", "external"]).toContain(chain.mode);
    }
  });

  it("gives every external chain somewhere to send the user", () => {
    for (const chain of WALLET_CHAINS.filter((c) => c.mode === "external")) {
      expect(chain.href).toBeTruthy();
    }
  });

  it("has install links for every chain, so the empty state is never blank", () => {
    for (const chain of WALLET_CHAINS) {
      expect(INSTALL_LINKS[chain.id].length).toBeGreaterThan(0);
      for (const link of INSTALL_LINKS[chain.id]) {
        expect(link.name.length).toBeGreaterThan(0);
        expect(link.url.startsWith("https://")).toBe(true);
      }
    }
  });

  it("rejects an unregistered chain instead of rendering nothing", () => {
    // @ts-expect-error — deliberately passing a chain we do not support
    expect(() => chainMeta("bitcoin")).toThrow(/未注册的钱包链/);
  });

  it("tags Wallet Standard wallets with their chain and a unique id", () => {
    const options = toWalletOptions([
      { name: "Phantom", icon: "data:image/svg+xml,phantom" },
      { name: "Solflare" },
    ]);
    expect(options).toEqual([
      { id: "solana:Phantom", chain: "solana", name: "Phantom", icon: "data:image/svg+xml,phantom" },
      { id: "solana:Solflare", chain: "solana", name: "Solflare", icon: undefined },
    ]);
    expect(new Set(options.map((w) => w.id)).size).toBe(2);
  });

  it("declares Aleo as a single-adapter chain", () => {
    expect(ALEO_WALLET_OPTIONS).toHaveLength(1);
    expect(ALEO_WALLET_OPTIONS[0].chain).toBe("aleo");
  });

  it("shortens long addresses but leaves short ones alone", () => {
    expect(shortWalletAddress("5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM")).toBe("5FHwkr…UJnM");
    expect(shortWalletAddress("ABC123")).toBe("ABC123");
  });
});

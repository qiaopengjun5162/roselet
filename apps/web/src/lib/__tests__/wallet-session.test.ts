/**
 * Exercises `connectSolanaWallet` against the REAL Wallet Standard registry.
 *
 * `wallet.test.ts` stubs the registry to test pure helpers. Here we register
 * wallets through `@wallet-standard/app` itself, so discovery, Phantom
 * preference, connect, signing and disconnect all run over the actual
 * protocol objects a browser extension registers.
 */
import { getWallets } from "@wallet-standard/app";

import {
  connectSolanaWallet,
  listSolanaWallets,
  solanaChainForCluster,
} from "../wallet";

type RegisteredWallet = Parameters<
  ReturnType<typeof getWallets>["register"]
>[0];

const ADDRESS = "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM";
const CHAINS = ["solana:devnet", "solana:mainnet"] as const;

interface Harness {
  wallet: RegisteredWallet;
  connect: jest.Mock;
  sign: jest.Mock;
  disconnect: jest.Mock;
  account: { address: string; chains: readonly string[]; features: string[] };
}

function makeWallet(
  name: string,
  options: {
    chains?: readonly string[];
    omitConnect?: boolean;
    omitSign?: boolean;
    omitDisconnect?: boolean;
    emptyAccounts?: boolean;
    emptySignOutput?: boolean;
  } = {},
): Harness {
  const account = {
    address: ADDRESS,
    chains: CHAINS,
    features: [],
  };
  const connect = jest.fn().mockResolvedValue({
    accounts: options.emptyAccounts ? [] : [account],
  });
  const sign = jest.fn().mockImplementation(
    async (...inputs: { transaction: Uint8Array }[]) =>
      options.emptySignOutput
        ? []
        : inputs.map((input) => ({
            signedTransaction: Uint8Array.from([...input.transaction, 99]),
          })),
  );
  const disconnect = jest.fn().mockResolvedValue(undefined);

  const features: Record<string, unknown> = {
    "standard:connect": options.omitConnect
      ? undefined
      : { version: "1.0.0", connect },
    "solana:signTransaction": options.omitSign
      ? undefined
      : {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signTransaction: sign,
        },
    "standard:disconnect": options.omitDisconnect
      ? undefined
      : { version: "1.0.0", disconnect },
  };

  const wallet = {
    version: "1.0.0",
    name,
    icon: "data:image/svg+xml,<svg/>",
    chains: options.chains ?? CHAINS,
    features,
    accounts: [account],
  } as unknown as RegisteredWallet;

  return { wallet, connect, sign, disconnect, account };
}

let cleanups: Array<() => void> = [];
function register(wallet: RegisteredWallet): void {
  cleanups.push(getWallets().register(wallet));
}

afterEach(() => {
  cleanups.forEach((unregister) => unregister());
  cleanups = [];
  jest.clearAllMocks();
});

describe("connectSolanaWallet · real Wallet Standard registry", () => {
  it("discovers registered Solana wallets and returns the connected address", async () => {
    const phantom = makeWallet("Phantom");
    const other = makeWallet("Solflare");
    register(phantom.wallet);
    register(other.wallet);

    expect(listSolanaWallets().map((w) => w.name).sort()).toEqual([
      "Phantom",
      "Solflare",
    ]);

    const session = await connectSolanaWallet();
    expect(session.address).toBe(ADDRESS);
    // Prefer Phantom when several wallets are installed.
    expect(phantom.connect).toHaveBeenCalledTimes(1);
    expect(other.connect).not.toHaveBeenCalled();
  });

  it("hands the wire bytes, account and configured chain to the wallet", async () => {
    const harness = makeWallet("Phantom");
    register(harness.wallet);
    const session = await connectSolanaWallet();

    const wire = new Uint8Array([10, 20, 30]);
    const signed = await session.signTransaction(wire);

    expect(harness.sign).toHaveBeenCalledTimes(1);
    expect(harness.sign.mock.calls[0][0]).toEqual({
      account: expect.objectContaining({ address: ADDRESS }),
      transaction: wire,
      chain: solanaChainForCluster(),
    });
    // The session returns outputs[0].signedTransaction verbatim.
    expect(signed).toEqual(new Uint8Array([10, 20, 30, 99]));
  });

  it("calls standard:disconnect and swallows a wallet-side failure", async () => {
    const harness = makeWallet("Phantom");
    register(harness.wallet);
    harness.disconnect.mockRejectedValueOnce(new Error("wallet closed"));
    const session = await connectSolanaWallet();

    expect(() => session.disconnect()).not.toThrow();
    expect(harness.disconnect).toHaveBeenCalledTimes(1);
  });

  it("filters out wallets that do not declare a solana: chain", async () => {
    const ethereum = makeWallet("Some Ethereum Wallet", {
      chains: ["eip155:1"],
    });
    register(ethereum.wallet);
    expect(listSolanaWallets()).toEqual([]);
    await expect(connectSolanaWallet()).rejects.toThrow(/未检测到 Solana 钱包/);
  });

  it("reports each missing capability in Chinese instead of crashing", async () => {
    const cases: Array<[string, Partial<Parameters<typeof makeWallet>[1]>, RegExp]> =
      [
        ["no connect feature", { omitConnect: true }, /不支持标准连接/],
        ["no accounts", { emptyAccounts: true }, /没有返回可用账户/],
        ["no sign feature", { omitSign: true }, /不支持交易签名/],
        ["empty sign output", { emptySignOutput: true }, /没有返回已签名的交易/],
      ];

    for (const [label, options, expected] of cases) {
      const harness = makeWallet("Phantom", options);
      const unregister = getWallets().register(harness.wallet);
      try {
        if (label === "empty sign output") {
          const session = await connectSolanaWallet();
          await expect(session.signTransaction(new Uint8Array([1]))).rejects.toThrow(
            expected,
          );
        } else {
          await expect(connectSolanaWallet()).rejects.toThrow(expected);
        }
      } finally {
        unregister();
      }
    }
  });

  it("falls back to the first wallet when Phantom is not installed", async () => {
    const solflare = makeWallet("Solflare");
    register(solflare.wallet);
    const session = await connectSolanaWallet();
    expect(session.address).toBe(ADDRESS);
    expect(solflare.connect).toHaveBeenCalledTimes(1);
  });
});

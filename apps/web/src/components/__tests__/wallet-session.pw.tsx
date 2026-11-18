/**
 * Real-browser check of the wallet session layer.
 *
 * A Solana extension registers itself by answering the `app-ready` event the
 * app dispatches from `getWallets()`. This test installs exactly such a wallet
 * into a Chromium page and clicks the real membership "connect" button. It
 * proves discovery + `standard:connect` work in an actual browser realm —
 * the one thing jsdom unit tests and the Node Devnet probe cannot cover.
 *
 * It deliberately does NOT broadcast: the remaining unknown is Phantom's own
 * extension implementation, not our code.
 */
import { expect, test } from "@playwright/experimental-ct-react";
import type { Page } from "@playwright/test";

import { WalletSessionFixture } from "@/components/__fixtures__/wallet-session";

const ADDRESS = "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM";

/**
 * Install a Wallet Standard wallet the way an extension does: listen for the
 * app-ready event, then call the `register` api handed to it.
 *
 * Done AFTER `mount` (not with `addInitScript`): Playwright CT has already
 * navigated its page by the time the `page` fixture is available, so an init
 * script would never run. `getWallets()` is called lazily on the first
 * connect click, so the listener is in place before app-ready is dispatched.
 */
async function installWallet(page: Page): Promise<void> {
  await page.evaluate((address: string) => {
    const account = {
      address,
      chains: ["solana:devnet", "solana:mainnet"],
      features: [] as string[],
      publicKey: new Uint8Array(32),
    };
    const wallet = {
      version: "1.0.0",
      name: "Phantom",
      icon: "data:image/svg+xml,<svg/>",
      chains: ["solana:devnet", "solana:mainnet"],
      accounts: [account],
      features: {
        "standard:connect": {
          version: "1.0.0",
          connect: async () => ({ accounts: [account] }),
        },
        "solana:signTransaction": {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signTransaction: async (...inputs: { transaction: Uint8Array }[]) =>
            inputs.map((i) => ({ signedTransaction: i.transaction })),
        },
        "standard:disconnect": {
          version: "1.0.0",
          disconnect: async () => {},
        },
      },
    };
    window.addEventListener("wallet-standard:app-ready", (event) => {
      const api = (event as CustomEvent<{ register: (w: unknown) => void }>)
        .detail;
      api.register(wallet);
    });
  }, ADDRESS);
}

test("discovers and connects to a Wallet Standard wallet in Chromium", async ({
  mount,
  page,
}) => {
  const component = await mount(<WalletSessionFixture />);
  await installWallet(page);
  await expect(component.getByTestId("wallet-address")).toHaveText("none");

  await component.getByRole("button", { name: "connect-wallet" }).click();

  // Check the error slot first: on failure its text says which step broke.
  await expect(component.getByTestId("wallet-error")).toBeEmpty();
  await expect(component.getByTestId("wallet-address")).toHaveText(ADDRESS);
});

import { fireEvent, render, screen } from "@testing-library/react";

import { WalletPicker } from "../wallet-picker";
import type { WalletOption } from "@/lib/wallet-chains";

const phantom: WalletOption = {
  id: "solana:Phantom",
  chain: "solana",
  name: "Phantom",
  icon: "data:image/svg+xml,phantom",
};
const solflare: WalletOption = { id: "solana:Solflare", chain: "solana", name: "Solflare" };

describe("WalletPicker", () => {
  it("groups wallets under their chain instead of one flat list", () => {
    render(
      <WalletPicker
        wallets={[phantom, solflare]}
        actionLabel={(wallet) => `连接 ${wallet.name}`}
        onPick={jest.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "Solana 钱包" })).toBeInTheDocument();
    // Aleo lives behind showExternal so single-chain surfaces stay focused.
    expect(screen.queryByRole("region", { name: "Aleo 钱包" })).not.toBeInTheDocument();
  });

  it("passes the whole wallet (not just its name) to the caller", () => {
    const onPick = jest.fn();
    render(
      <WalletPicker
        wallets={[phantom]}
        actionLabel={(wallet) => `连接 ${wallet.name}`}
        onPick={onPick}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /连接 Phantom/ }));
    expect(onPick).toHaveBeenCalledWith(phantom);
  });

  it("shows install links when the chain has no detected wallet", () => {
    render(
      <WalletPicker wallets={[]} actionLabel={(wallet) => wallet.name} onPick={jest.fn()} />,
    );

    expect(screen.getByText(/未检测到 Solana 钱包/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Phantom/ })).toHaveAttribute(
      "href",
      "https://phantom.app/download",
    );
  });

  it("says how many wallets were detected only when there is a choice", () => {
    const { rerender } = render(
      <WalletPicker
        wallets={[phantom]}
        actionLabel={(wallet) => `连接 ${wallet.name}`}
        onPick={jest.fn()}
      />,
    );
    expect(screen.queryByText(/检测到 1 个钱包/)).not.toBeInTheDocument();

    rerender(
      <WalletPicker
        wallets={[phantom, solflare]}
        actionLabel={(wallet) => `连接 ${wallet.name}`}
        onPick={jest.fn()}
      />,
    );
    expect(screen.getByText(/检测到 2 个钱包/)).toBeInTheDocument();
  });

  it("disables every row and shows the busy label while signing", () => {
    render(
      <WalletPicker
        wallets={[phantom]}
        busy
        busyLabel="等待钱包签名…"
        actionLabel={(wallet) => `连接 ${wallet.name}`}
        onPick={jest.fn()}
      />,
    );

    const row = screen.getByRole("button", { name: /等待钱包签名/ });
    expect(row).toBeDisabled();
  });

  it("shows the Aleo group as a hand-off, not a second inline connector", () => {
    const onExternal = jest.fn();
    render(
      <WalletPicker
        wallets={[phantom]}
        showExternal
        actionLabel={(wallet) => `使用 ${wallet.name}`}
        onPick={jest.fn()}
        onExternal={onExternal}
      />,
    );

    expect(screen.getByRole("region", { name: "Aleo 钱包" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /使用 Leo Wallet/ }));
    expect(onExternal).toHaveBeenCalledTimes(1);
  });

  it("links to the owning page when the caller does not handle external chains", () => {
    render(
      <WalletPicker
        wallets={[phantom]}
        showExternal
        actionLabel={(wallet) => `连接 ${wallet.name}`}
        onPick={jest.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: /连接 Leo Wallet/ })).toHaveAttribute(
      "href",
      "/private-vault",
    );
  });
});

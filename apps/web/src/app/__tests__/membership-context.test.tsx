import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import {
  MembershipProvider,
  useMembership,
  useOptionalMembership,
} from "@/app/membership-context";

function Probe() {
  const m = useMembership();
  return (
    <div>
      <span data-testid="member">{String(m.isMember)}</span>
      <span data-testid="panel">{String(m.panelOpen)}</span>
      <span data-testid="target">{String(m.mintTargetRoseId)}</span>
      <span data-testid="address">{String(m.walletAddress)}</span>
      <span data-testid="error">{String(m.connectError)}</span>
      <span data-testid="optional">{String(useOptionalMembership() !== null)}</span>
      <button onClick={() => void m.connectWallet()}>connect</button>
      <button onClick={m.disconnectWallet}>disconnect</button>
      <button onClick={() => m.openMint("rose-9")}>open-mint</button>
      <button onClick={m.clearMintTarget}>clear-mint</button>
      <button onClick={m.closePanel}>close-panel</button>
      <button onClick={m.toggleMember}>toggle</button>
      <button onClick={m.openPanel}>open-panel</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <MembershipProvider>
      <Probe />
    </MembershipProvider>,
  );
}

const connect = jest.fn();
const disconnect = jest.fn();

beforeEach(() => {
  connect.mockReset().mockResolvedValue({ publicKey: { toBase58: () => "WALLET_1" } });
  disconnect.mockReset().mockResolvedValue(undefined);
  window.solana = { connect, disconnect } as unknown as NonNullable<typeof window.solana>;
});

afterEach(() => {
  delete window.solana;
});

describe("MembershipProvider state machine", () => {
  it("starts in normal mode with no wallet and no Web3 state", () => {
    renderProbe();
    expect(screen.getByTestId("member")).toHaveTextContent("false");
    expect(screen.getByTestId("panel")).toHaveTextContent("false");
    expect(screen.getByTestId("address")).toHaveTextContent("null");
    expect(screen.getByTestId("optional")).toHaveTextContent("true");
  });

  it("stores the wallet address after a successful connect", async () => {
    renderProbe();
    fireEvent.click(screen.getByRole("button", { name: "connect" }));
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("WALLET_1"));
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("reports a missing wallet instead of throwing", async () => {
    delete window.solana;
    renderProbe();
    fireEvent.click(screen.getByRole("button", { name: "connect" }));
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("未检测到 Solana 钱包"),
    );
  });

  it("surfaces a wallet error message when connect rejects", async () => {
    connect.mockRejectedValueOnce(new Error("用户拒绝授权"));
    renderProbe();
    fireEvent.click(screen.getByRole("button", { name: "connect" }));
    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("用户拒绝授权"),
    );
  });

  it("clears the address and disconnects the injected wallet", async () => {
    renderProbe();
    fireEvent.click(screen.getByRole("button", { name: "connect" }));
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("WALLET_1"));
    fireEvent.click(screen.getByRole("button", { name: "disconnect" }));
    await waitFor(() => expect(screen.getByTestId("address")).toHaveTextContent("null"));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("enters member mode with a preselected rose, then clears it", () => {
    renderProbe();
    fireEvent.click(screen.getByRole("button", { name: "open-mint" }));
    expect(screen.getByTestId("member")).toHaveTextContent("true");
    expect(screen.getByTestId("panel")).toHaveTextContent("true");
    expect(screen.getByTestId("target")).toHaveTextContent("rose-9");

    fireEvent.click(screen.getByRole("button", { name: "close-panel" }));
    expect(screen.getByTestId("panel")).toHaveTextContent("false");
    expect(screen.getByTestId("target")).toHaveTextContent("rose-9");

    fireEvent.click(screen.getByRole("button", { name: "open-panel" }));
    expect(screen.getByTestId("panel")).toHaveTextContent("true");
    expect(screen.getByTestId("target")).toHaveTextContent("null");

    fireEvent.click(screen.getByRole("button", { name: "clear-mint" }));
    expect(screen.getByTestId("target")).toHaveTextContent("null");
  });

  it("leaving member mode resets the mint target", () => {
    renderProbe();
    fireEvent.click(screen.getByRole("button", { name: "open-mint" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("member")).toHaveTextContent("false");
    expect(screen.getByTestId("panel")).toHaveTextContent("false");
    expect(screen.getByTestId("target")).toHaveTextContent("null");
  });

  it("throws a clear error when useMembership has no provider", () => {
    const original = console.error;
    console.error = jest.fn();
    try {
      expect(() => render(<Probe />)).toThrow("useMembership 必须在 MembershipProvider 内使用");
    } finally {
      console.error = original;
    }
  });
});

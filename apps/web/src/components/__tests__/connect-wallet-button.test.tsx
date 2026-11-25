import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { ConnectWalletButton } from "../connect-wallet-button";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

interface MockMembership {
  memberAddress: string | null;
  walletAddress: string | null;
  solanaWallets: Array<{ name: string; icon?: string }>;
  loggingIn: boolean;
  connectError: string | null;
  loginWithWallet: jest.Mock;
  disconnectWallet: jest.Mock;
}

let mockMembership: MockMembership | null = null;
jest.mock("@/app/membership-context", () => ({
  useOptionalMembership: () => mockMembership,
}));

function membership(overrides: Partial<MockMembership> = {}): MockMembership {
  return {
    memberAddress: null,
    walletAddress: null,
    solanaWallets: [{ name: "Phantom" }, { name: "Solflare" }],
    loggingIn: false,
    connectError: null,
    loginWithWallet: jest.fn().mockResolvedValue(true),
    disconnectWallet: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockPush.mockClear();
  mockMembership = membership();
});

describe("ConnectWalletButton", () => {
  it("renders nothing without a membership provider (plain shell, unit tests)", () => {
    mockMembership = null;
    const { container } = render(<ConnectWalletButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is the single entry point: one button opens every supported chain", () => {
    render(<ConnectWalletButton />);

    const trigger = screen.getByRole("button", { name: "连接钱包" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "连接钱包" });
    expect(within(dialog).getByRole("region", { name: "Solana 钱包" })).toBeInTheDocument();
    expect(within(dialog).getByRole("region", { name: "Aleo 钱包" })).toBeInTheDocument();
    // One row per detected wallet — not one entry per chain.
    expect(within(dialog).getByRole("button", { name: /使用 Phantom 登录/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /使用 Solflare 登录/ })).toBeInTheDocument();
  });

  it("logs in with the chosen wallet and routes to the membership centre", async () => {
    render(<ConnectWalletButton />);
    fireEvent.click(screen.getByRole("button", { name: "连接钱包" }));
    fireEvent.click(screen.getByRole("button", { name: /使用 Phantom 登录/ }));

    expect(mockMembership!.loginWithWallet).toHaveBeenCalledWith("Phantom");
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/membership");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows the bound wallet instead of asking to connect again", () => {
    mockMembership = membership({
      memberAddress: "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM",
    });
    render(<ConnectWalletButton />);

    const trigger = screen.getByRole("button", { name: "钱包已连接" });
    expect(trigger).toHaveTextContent("5FHwkr…UJnM");
  });

  it("sends members to the Vault page for Aleo, and everyone else to the gate", () => {
    render(<ConnectWalletButton />);
    fireEvent.click(screen.getByRole("button", { name: "连接钱包" }));
    fireEvent.click(screen.getByRole("button", { name: /去 Leo Wallet 连接 Vault/ }));
    expect(mockPush).toHaveBeenCalledWith("/membership");

    mockPush.mockClear();
    mockMembership = membership({ memberAddress: "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM" });
    render(<ConnectWalletButton />);
    const dialogs = screen.getAllByRole("button", { name: "钱包已连接" });
    fireEvent.click(dialogs[dialogs.length - 1]);
    const dialog = screen.getAllByRole("dialog", { name: "连接钱包" }).at(-1)!;
    fireEvent.click(within(dialog).getByRole("button", { name: /去 Leo Wallet 连接 Vault/ }));
    expect(mockPush).toHaveBeenCalledWith("/private-vault");
  });

  it("surfaces a login error and keeps the chooser open", async () => {
    mockMembership = membership({
      loginWithWallet: jest.fn().mockResolvedValue(false),
    });
    const { rerender } = render(<ConnectWalletButton />);
    fireEvent.click(screen.getByRole("button", { name: "连接钱包" }));
    fireEvent.click(screen.getByRole("button", { name: /使用 Phantom 登录/ }));

    // The provider writes the failure into connectError; the button renders it.
    mockMembership = { ...mockMembership!, connectError: "签名校验失败" };
    rerender(<ConnectWalletButton />);

    expect(screen.getByRole("alert")).toHaveTextContent("签名校验失败");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

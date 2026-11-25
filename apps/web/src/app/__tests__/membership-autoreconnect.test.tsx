import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const LAST_WALLET_KEY = "roselet:solana-last-wallet";

const mockConnect = jest.fn();
let mockWallets: Array<{ name: string; icon?: string }> = [];

jest.mock("@/lib/wallet", () => ({
  connectSolanaWallet: (...args: unknown[]) => mockConnect(...args),
  listSolanaWalletOptions: () => mockWallets,
  onSolanaWalletsChanged: () => () => {},
}));

import { MembershipProvider, useMembership } from "@/app/membership-context";

function Harness() {
  const { isMember, toggleMember, connectWallet, disconnectWallet, walletAddress } = useMembership();
  return (
    <div>
      <button onClick={toggleMember}>toggle</button>
      <button onClick={() => void connectWallet("Phantom")}>connect</button>
      <button onClick={disconnectWallet}>disconnect</button>
      <span data-testid="addr">{walletAddress ?? "none"}</span>
      <span data-testid="member">{String(isMember)}</span>
    </div>
  );
}

const okSession = { address: "ABC123", signTransaction: jest.fn(), disconnect: jest.fn() };

/** Membership comes from the stored account; seed one with a bound wallet. */
function seedMember() {
  window.localStorage.setItem(
    "user",
    JSON.stringify({
      id: "u1",
      nickname: "member",
      created_at: new Date().toISOString(),
      wallet_address: "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM",
      member_since: new Date().toISOString(),
    }),
  );
}

beforeEach(() => {
  mockConnect.mockReset();
  mockWallets = [];
  window.localStorage.clear();
});

describe("会员钱包自动重连", () => {
  it("普通用户（非会员）永不触发任何钱包连接", async () => {
    window.localStorage.setItem(LAST_WALLET_KEY, "Phantom");
    mockWallets = [{ name: "Phantom" }];
    render(<MembershipProvider><Harness /></MembershipProvider>);

    await waitFor(() => expect(screen.getByTestId("member")).toHaveTextContent("false"));
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("进入会员后用上次记住的钱包静默重连（silent:true）", async () => {
    seedMember();
    window.localStorage.setItem(LAST_WALLET_KEY, "Phantom");
    mockWallets = [{ name: "Phantom" }];
    mockConnect.mockResolvedValue(okSession);
    render(<MembershipProvider><Harness /></MembershipProvider>);

    fireEvent.click(screen.getByText("toggle"));

    await waitFor(() => expect(screen.getByTestId("addr")).toHaveTextContent("ABC123"));
    expect(mockConnect).toHaveBeenCalledWith("Phantom", { silent: true });
  });

  it("上次记住的钱包已不在列表时不重连", async () => {
    seedMember();
    window.localStorage.setItem(LAST_WALLET_KEY, "Phantom");
    mockWallets = [{ name: "Solflare" }];
    render(<MembershipProvider><Harness /></MembershipProvider>);

    fireEvent.click(screen.getByText("toggle"));
    await act(async () => {});

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("静默重连被拒绝时保持安静，不抛错也不显示错误", async () => {
    seedMember();
    window.localStorage.setItem(LAST_WALLET_KEY, "Phantom");
    mockWallets = [{ name: "Phantom" }];
    mockConnect.mockRejectedValue(new Error("User rejected"));
    render(<MembershipProvider><Harness /></MembershipProvider>);

    fireEvent.click(screen.getByText("toggle"));
    await act(async () => {});

    // 组件没崩、地址仍未连接，且只尝试了一次（不会每次渲染重试）
    expect(screen.getByTestId("addr")).toHaveTextContent("none");
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("主动连接记住钱包，断开后清除记忆（刷新不再自动连回）", async () => {
    seedMember();
    mockWallets = [{ name: "Phantom" }];
    mockConnect.mockResolvedValue(okSession);
    render(<MembershipProvider><Harness /></MembershipProvider>);

    fireEvent.click(screen.getByText("connect"));
    await waitFor(() => expect(screen.getByTestId("addr")).toHaveTextContent("ABC123"));
    expect(window.localStorage.getItem(LAST_WALLET_KEY)).toBe("Phantom");

    fireEvent.click(screen.getByText("disconnect"));
    expect(window.localStorage.getItem(LAST_WALLET_KEY)).toBeNull();
    expect(screen.getByTestId("addr")).toHaveTextContent("none");
  });
});

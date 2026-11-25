import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockConnect = jest.fn();
const mockChallenge = jest.fn();
const mockVerify = jest.fn();
let store: unknown = null;

jest.mock("@/lib/wallet", () => ({
  connectSolanaWallet: (...args: unknown[]) => mockConnect(...args),
  listSolanaWalletOptions: () => [{ name: "Phantom" }],
  onSolanaWalletsChanged: () => () => {},
}));

jest.mock("@/lib/api", () => ({
  getUser: () => store,
  setUser: (user: unknown) => {
    store = user;
  },
  setToken: jest.fn(),
  setRefreshToken: jest.fn(),
  requestWalletChallenge: (...args: unknown[]) => mockChallenge(...args),
  verifyWalletLogin: (...args: unknown[]) => mockVerify(...args),
}));

import { MembershipProvider, useMembership } from "@/app/membership-context";

const ADDRESS = "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM";

function Harness() {
  const { hasMembership, memberAddress, loginWithWallet, connectError, isMember } =
    useMembership();
  return (
    <div>
      <button onClick={() => void loginWithWallet("Phantom")}>wallet-login</button>
      <span data-testid="has">{String(hasMembership)}</span>
      <span data-testid="addr">{memberAddress ?? "none"}</span>
      <span data-testid="view">{String(isMember)}</span>
      <span data-testid="error">{connectError ?? ""}</span>
    </div>
  );
}

describe("钱包登录 = 会员身份", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store = null;
    window.localStorage.clear();
    mockConnect.mockResolvedValue({
      address: ADDRESS,
      signTransaction: jest.fn(),
      signMessage: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      disconnect: jest.fn(),
    });
    mockChallenge.mockResolvedValue({
      nonce: "n1",
      message: "Roselet wants you to sign in",
      expires_at: new Date().toISOString(),
    });
    mockVerify.mockResolvedValue({
      access_token: "jwt",
      refresh_token: "refresh",
      user: {
        id: "u1",
        nickname: "Solana-5FHwkr",
        created_at: new Date().toISOString(),
        wallet_address: ADDRESS,
        member_since: new Date().toISOString(),
      },
    });
  });

  it("签名后由服务端签发身份，会员状态来自账号而不是开关", async () => {
    render(
      <MembershipProvider>
        <Harness />
      </MembershipProvider>,
    );

    expect(screen.getByTestId("has")).toHaveTextContent("false");
    fireEvent.click(screen.getByText("wallet-login"));

    await waitFor(() => expect(screen.getByTestId("has")).toHaveTextContent("true"));
    expect(screen.getByTestId("addr")).toHaveTextContent(ADDRESS);
    expect(screen.getByTestId("view")).toHaveTextContent("true");

    expect(mockChallenge).toHaveBeenCalledWith(ADDRESS);
    expect(mockVerify).toHaveBeenCalledWith({
      walletAddress: ADDRESS,
      nonce: "n1",
      signature: expect.any(String),
    });
    // The signed challenge is what proves ownership; the signature must be
    // base58, never the raw bytes stringified.
    const arg = mockVerify.mock.calls[0][0] as { signature: string };
    expect(arg.signature).not.toContain(",");
    expect(arg.signature.length).toBeGreaterThan(2);
  });

  it("签名失败时不授予会员，只留下错误", async () => {
    mockVerify.mockRejectedValue(new Error("签名校验失败，钱包归属未通过"));
    render(
      <MembershipProvider>
        <Harness />
      </MembershipProvider>,
    );

    fireEvent.click(screen.getByText("wallet-login"));

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("签名校验失败"),
    );
    expect(screen.getByTestId("has")).toHaveTextContent("false");
    expect(screen.getByTestId("addr")).toHaveTextContent("none");
  });
});

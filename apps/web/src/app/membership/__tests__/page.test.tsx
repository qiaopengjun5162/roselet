import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

let store: unknown = null;
const mockLogout = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/wallet", () => ({
  connectSolanaWallet: jest.fn(),
  listSolanaWalletOptions: () => [],
  onSolanaWalletsChanged: () => () => {},
}));

jest.mock("@/lib/api", () => ({
  getUser: () => store,
  setUser: (user: unknown) => {
    store = user;
  },
  setToken: jest.fn(),
  setRefreshToken: jest.fn(),
  logout: () => {
    mockLogout();
    store = null;
  },
  requestWalletChallenge: jest.fn(),
  verifyWalletLogin: jest.fn(),
}));

import { MembershipProvider } from "@/app/membership-context";
import MembershipPage from "../page";

const ADDRESS = "5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZwCkP2UJnM";

function renderPage() {
  return render(
    <MembershipProvider>
      <MembershipPage />
    </MembershipProvider>,
  );
}

describe("MembershipPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store = null;
    window.localStorage.clear();
  });

  it("未登录时给出两条登录路径", () => {
    renderPage();
    expect(screen.getByText("会员中心")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "钱包登录 · 开通会员" })).toHaveAttribute(
      "href",
      "/login?mode=wallet",
    );
    expect(screen.getByRole("link", { name: "用昵称登录" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("已登录但没绑钱包时提示绑定", () => {
    store = {
      id: "u1",
      nickname: "alice",
      created_at: new Date().toISOString(),
      wallet_address: null,
    };
    renderPage();
    expect(screen.getByText("绑定钱包，开通会员")).toBeInTheDocument();
    expect(screen.getByText(/未检测到 Solana 钱包/)).toBeInTheDocument();
  });

  it("会员展示绑定地址、加入时间与会员功能", () => {
    store = {
      id: "u1",
      nickname: "alice",
      created_at: new Date().toISOString(),
      wallet_address: ADDRESS,
      member_since: "2026-11-25T00:00:00Z",
    };
    renderPage();

    expect(screen.getByText("已开通会员")).toBeInTheDocument();
    expect(screen.getByText(/5FHwkr…UJnM/)).toBeInTheDocument();
    expect(screen.getByText("2026/11/25")).toBeInTheDocument();
    expect(screen.getByText("玫瑰上链存证")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开上链面板" })).toBeInTheDocument();
  });

  it("会员可以进入会员版浏览（不弹上链面板）", () => {
    store = {
      id: "u1",
      nickname: "alice",
      created_at: new Date().toISOString(),
      wallet_address: ADDRESS,
      member_since: "2026-11-25T00:00:00Z",
    };
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "进入会员版浏览" }));
    expect(
      screen.queryByRole("button", { name: "进入会员版浏览" }),
    ).not.toBeInTheDocument();
  });

  it("退出登录会清空账号状态", () => {
    store = {
      id: "u1",
      nickname: "alice",
      created_at: new Date().toISOString(),
      wallet_address: ADDRESS,
      member_since: "2026-11-25T00:00:00Z",
    };
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// MembershipProvider 顶层会加载 lib/wallet；jsdom 下用最小桩替掉，
// 与 membership-panel.test.tsx 的做法一致。
jest.mock("@/lib/wallet", () => ({
  connectSolanaWallet: jest.fn(),
  listSolanaWalletOptions: () => [],
  onSolanaWalletsChanged: () => () => {},
}));

import { MembershipProvider, useMembership } from "@/app/membership-context";
import { MemberOnly } from "../member-only";

function Controls() {
  const { openPanel, toggleMember } = useMembership();
  return (
    <>
      <button onClick={openPanel}>enter-member</button>
      <button onClick={toggleMember}>toggle-member</button>
    </>
  );
}

function renderGate() {
  return render(
    <MembershipProvider>
      <Controls />
      <MemberOnly>
        <div data-testid="web3">连接钱包 / 上链</div>
      </MemberOnly>
    </MembershipProvider>,
  );
}

/** Membership now comes from the stored account (server-verified). */
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
  window.localStorage.clear();
});

describe("MemberOnly", () => {
  it("默认普通模式零 Web3 痕迹", () => {
    renderGate();
    expect(screen.queryByTestId("web3")).not.toBeInTheDocument();
  });

  it("非会员点开关不会解锁 Web3（前端开关不再是权限）", () => {
    renderGate();
    fireEvent.click(screen.getByText("toggle-member"));
    expect(screen.queryByTestId("web3")).not.toBeInTheDocument();
  });

  it("已绑定钱包的会员进入会员版后渲染 Web3 内容", () => {
    seedMember();
    renderGate();
    fireEvent.click(screen.getByText("enter-member"));
    expect(screen.getByTestId("web3")).toBeInTheDocument();
  });

  it("退出会员版后重新隐藏", () => {
    seedMember();
    renderGate();
    fireEvent.click(screen.getByText("enter-member"));
    expect(screen.getByTestId("web3")).toBeInTheDocument();
    fireEvent.click(screen.getByText("toggle-member"));
    expect(screen.queryByTestId("web3")).not.toBeInTheDocument();
  });

  it("没有 MembershipProvider 时静默隐藏（独立页面 / 单测安全）", () => {
    render(
      <MemberOnly>
        <div data-testid="web3">连接钱包 / 上链</div>
      </MemberOnly>,
    );
    expect(screen.queryByTestId("web3")).not.toBeInTheDocument();
  });
});

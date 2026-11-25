import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/lib/wallet", () => ({
  connectSolanaWallet: jest.fn(),
  listSolanaWalletOptions: () => [],
  onSolanaWalletsChanged: () => () => {},
}));

import { MembershipProvider, useMembership } from "@/app/membership-context";
import { MembershipBanner } from "../membership-banner";

function EnterMember() {
  const { openPanel } = useMembership();
  return <button onClick={openPanel}>enter-member</button>;
}

function renderBanner() {
  return render(
    <MembershipProvider>
      <EnterMember />
      <MembershipBanner />
    </MembershipProvider>,
  );
}

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

describe("MembershipBanner", () => {
  it("普通模式不显示会员版状态条", () => {
    renderBanner();
    expect(screen.queryByTestId("membership-banner")).not.toBeInTheDocument();
    expect(screen.queryByText("返回普通版")).not.toBeInTheDocument();
  });

  it("进入会员版后显示状态条与两个出口", () => {
    seedMember();
    renderBanner();
    fireEvent.click(screen.getByText("enter-member"));
    expect(screen.getByTestId("membership-banner")).toBeInTheDocument();
    expect(screen.getByText(/会员版 · Web3 功能已解锁/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开上链面板" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回普通版" })).toBeInTheDocument();
  });

  it("点「返回普通版」立刻退出会员模式", () => {
    seedMember();
    renderBanner();
    fireEvent.click(screen.getByText("enter-member"));
    fireEvent.click(screen.getByRole("button", { name: "返回普通版" }));
    expect(screen.queryByTestId("membership-banner")).not.toBeInTheDocument();
  });
});

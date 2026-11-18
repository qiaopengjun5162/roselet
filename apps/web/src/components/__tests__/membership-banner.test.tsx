import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

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

describe("MembershipBanner", () => {
  it("普通模式不显示会员版状态条", () => {
    renderBanner();
    expect(screen.queryByTestId("membership-banner")).not.toBeInTheDocument();
    expect(screen.queryByText("返回普通版")).not.toBeInTheDocument();
  });

  it("进入会员版后显示状态条与两个出口", () => {
    renderBanner();
    fireEvent.click(screen.getByText("enter-member"));
    expect(screen.getByTestId("membership-banner")).toBeInTheDocument();
    expect(screen.getByText(/会员版 · Web3 功能已解锁/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "打开上链面板" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回普通版" })).toBeInTheDocument();
  });

  it("点「返回普通版」立刻退出会员模式", () => {
    renderBanner();
    fireEvent.click(screen.getByText("enter-member"));
    fireEvent.click(screen.getByRole("button", { name: "返回普通版" }));
    expect(screen.queryByTestId("membership-banner")).not.toBeInTheDocument();
  });
});

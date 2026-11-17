import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/components/tip-ticker", () => ({
  TipTicker: () => <div data-testid="tip-ticker" />,
}));

jest.mock("@/components/activity-feed", () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
}));

// 门闩本身由 member-only.test.tsx 验证；这里只确认首页确实把 Web3 入口
// 放进了门闩（普通模式隐藏、会员版才出现）。
let memberMode = false;
jest.mock("@/components/member-only", () => ({
  MemberOnly: ({ children }: { children: React.ReactNode }) =>
    memberMode ? <>{children}</> : null,
}));

import Home from "../page";

describe("Home", () => {
  afterEach(() => { memberMode = false; });

  it("普通模式零 Web3 痕迹", () => {
    render(<Home />);
    expect(
      screen.queryByRole("link", { name: "使用 Aleo 私密 Vault" }),
    ).not.toBeInTheDocument();
  });

  it("会员版才出现 Aleo 私密 Vault 入口", () => {
    memberMode = true;
    render(<Home />);
    expect(screen.getByRole("link", { name: "使用 Aleo 私密 Vault" })).toHaveAttribute(
      "href",
      "/private-vault",
    );
  });
});

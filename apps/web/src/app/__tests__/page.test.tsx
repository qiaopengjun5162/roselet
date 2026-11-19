import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PRODUCT_ONE_LINER_ZH, PRODUCT_TAGLINE_ZH } from "@roselet/core";

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

  // 「一句话讲不清楚就不是好项目」：首屏这句话是产品定位，不是装饰文案。
  // 有人把它改回抽象口号时，这条测试要红，而不是等试用者看不懂才被发现。
  it("首屏用一句话讲清产品要做什么", () => {
    render(<Home />);
    expect(
      screen.getByText(PRODUCT_ONE_LINER_ZH),
    ).toBeInTheDocument();
    expect(screen.queryByText("等待宇宙的回响")).not.toBeInTheDocument();
  });

  // 「毫无耐心、点两下没反应就关掉」：按钮必须紧跟一句话，不能排在提示条、
  // 动态或三块说明卡之后 —— 手机 390px 下三块卡会纵向堆叠，把按钮挤到
  // 折叠线以下。用 DOM 顺序守住，别等试用者找不到入口才发现。
  it("主按钮排在所有说明内容之前（手机第一屏能点到）", () => {
    render(<Home />);
    const button = screen.getByRole("button", { name: "种一朵玫瑰" });
    const isAfter = (el: Element) =>
      Boolean(button.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(isAfter(screen.getByTestId("tip-ticker"))).toBe(true);
    expect(isAfter(screen.getByTestId("activity-feed"))).toBe(true);
    expect(isAfter(screen.getByText("玫瑰", { selector: "h3" }))).toBe(true);
  });

  // 不忘初心：最初那句「一起来种一个玫瑰花圃吧」必须和产品一句话同时出现在首屏。
  it("首屏显示初心标语，和产品一句话并存", () => {
    render(<Home />);
    expect(screen.getByTestId("product-tagline")).toHaveTextContent(PRODUCT_TAGLINE_ZH);
    expect(screen.getByText(PRODUCT_ONE_LINER_ZH)).toBeInTheDocument();
  });

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

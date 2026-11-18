import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TipTicker } from "../tip-ticker";

const mockGetTips = jest.fn();

jest.mock("@/lib/recommend", () => ({
  getTips: (...args: unknown[]) => mockGetTips(...args),
}));

describe("TipTicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTips.mockResolvedValue([{ text: "可以不设密码，像把钥匙藏在花盆底下。" }]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders tips for the requested context", async () => {
    render(<TipTicker context="login" />);

    await waitFor(() => {
      expect(screen.getByText(/可以不设密码/)).toBeInTheDocument();
    });
    expect(mockGetTips).toHaveBeenCalledWith("login");
  });

  it("rotates through multiple tips and cleans up on unmount", async () => {
    jest.useFakeTimers();
    mockGetTips.mockResolvedValue([
      { text: "first tip" },
      { text: "second tip" },
    ]);

    const { unmount } = render(<TipTicker context="home" />);

    await waitFor(() => {
      expect(screen.getByText("first tip")).toBeInTheDocument();
    });

    act(() => {
      jest.advanceTimersByTime(5200);
    });

    await waitFor(() => {
      expect(screen.getByText("second tip")).toBeInTheDocument();
    });

    unmount();
  });

  // 390px 手机实测：最长的一条纸条 27 个字，单行 nowrap + ellipsis 会被切掉
  // 48px，显示成「…」——用户看到的是一个坏控件，不是一句提示。这里守住
  // 「允许换行」，别再把 truncate / whitespace-nowrap 加回来。
  it("纸条允许换行，不允许单行截断成省略号", () => {
    const source = readFileSync(
      resolve(__dirname, "../tip-ticker.tsx"),
      "utf8",
    )
      // 先去掉注释：注释里会解释「为什么不能用某个类」，不该被自己判红。
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).not.toMatch(/\btruncate\b/);
    expect(source).not.toMatch(/whitespace-nowrap/);
    expect(source).not.toMatch(/text-ellipsis/);
  });
});

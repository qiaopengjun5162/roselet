import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WEEK_NUDGE_LABEL } from "@roselet/core";

const mockGetToken = jest.fn();
jest.mock("@/lib/api", () => ({
  getToken: () => mockGetToken(),
}));

const mockLoadWeekReview = jest.fn();
jest.mock("@/lib/week-data", () => ({
  loadWeekReview: (...args: unknown[]) => mockLoadWeekReview(...args),
}));

import { WeekNudge } from "../week-nudge";

const review = (over: Record<string, unknown> = {}) => ({
  total: 3,
  in_week: 2,
  days_since_first: 8,
  days_until_ready: 0,
  ready: true,
  counts: { gratitude: 1, anxiety: 0, hope: 1 },
  quotes: [],
  ...over,
});

describe("WeekNudge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockGetToken.mockReturnValue("token");
  });

  it("满 7 天后在首页给出「这一周」的入口", async () => {
    mockLoadWeekReview.mockResolvedValue(review());

    render(<WeekNudge />);

    const link = await screen.findByTestId("week-nudge");
    expect(link).toHaveAttribute("href", "/week");
    expect(link).toHaveTextContent(WEEK_NUDGE_LABEL);
  });

  // 不催、不打卡：没满 7 天就一个字都不说，否则首页会变成倒计时。
  it("未满 7 天不显示，也不提前剧透", async () => {
    mockLoadWeekReview.mockResolvedValue(review({ ready: false, days_since_first: 3, days_until_ready: 4 }));

    render(<WeekNudge />);

    await waitFor(() => expect(mockLoadWeekReview).toHaveBeenCalled());
    expect(screen.queryByTestId("week-nudge")).not.toBeInTheDocument();
  });

  it("未登录时不请求、不渲染", async () => {
    mockGetToken.mockReturnValue(null);

    render(<WeekNudge />);

    expect(screen.queryByTestId("week-nudge")).not.toBeInTheDocument();
    expect(mockLoadWeekReview).not.toHaveBeenCalled();
  });

  it("一朵都没有时不显示", async () => {
    mockLoadWeekReview.mockResolvedValue(review({ total: 0, in_week: 0, ready: false }));

    render(<WeekNudge />);

    await waitFor(() => expect(mockLoadWeekReview).toHaveBeenCalled());
    expect(screen.queryByTestId("week-nudge")).not.toBeInTheDocument();
  });

  // 首页不能因为一个提示而报错。
  it("读取失败时安静地什么都不显示", async () => {
    mockLoadWeekReview.mockRejectedValue(new Error("boom"));

    render(<WeekNudge />);

    await waitFor(() => expect(mockLoadWeekReview).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId("week-nudge")).not.toBeInTheDocument());
  });
});

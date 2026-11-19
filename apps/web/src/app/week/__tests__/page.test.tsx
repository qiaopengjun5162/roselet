import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  WEEK_EMPTY_BODY,
  WEEK_NO_QUOTES,
  WEEK_PAGE_TITLE,
  WEEK_PENDING_BODY,
  WEEK_QUOTES_TITLE,
  WEEK_READY_FOOTER,
} from "@roselet/core";
import type { WeekReview } from "@roselet/core";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockGetMyRoses = jest.fn();
const mockGetToken = jest.fn();
jest.mock("@/lib/api", () => ({
  getMyRoses: (...args: unknown[]) => mockGetMyRoses(...args),
  getToken: () => mockGetToken(),
}));

const mockBuildWeekReview = jest.fn();
jest.mock("@/lib/recommend", () => ({
  buildWeekReview: (...args: unknown[]) => mockBuildWeekReview(...args),
}));

import WeekPage from "../page";

const roseRow = (id: string, created_at = "2026-11-18T00:00:00Z") => ({
  id,
  color: "red",
  gratitude: "一句",
  anxiety: null,
  hope: null,
  user_id: "u",
  nickname: "小满",
  like_count: 0,
  ai_reply: null,
  is_private: false,
  created_at,
  recipient_nickname: null,
  is_gift: false,
});

function review(overrides: Partial<WeekReview> = {}): WeekReview {
  return {
    total: 2,
    in_week: 1,
    days_since_first: 9,
    days_until_ready: 0,
    ready: true,
    counts: { gratitude: 1, anxiety: 0, hope: 1 },
    quotes: [
      { id: "r2", kind: "hope", text: "想学陶艺", age_days: 1 },
      { id: "r1", kind: "gratitude", text: "邻居帮我搬花", age_days: 9 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetToken.mockReturnValue("jwt-token");
  mockGetMyRoses.mockResolvedValue({ data: [roseRow("r2"), roseRow("r1")], total: 2, page: 1, per_page: 100 });
  mockBuildWeekReview.mockResolvedValue(review());
});

describe("/week：一周后到底能看见什么", () => {
  it("未登录先去取名，不显示别人的回顾", async () => {
    mockGetToken.mockReturnValue(null);
    render(<WeekPage />);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
    expect(mockGetMyRoses).not.toHaveBeenCalled();
  });

  it("空花圃指向「种第一朵」，而不是空白页", async () => {
    mockGetMyRoses.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 100 });
    mockBuildWeekReview.mockResolvedValue(review({ total: 0, in_week: 0, ready: false, quotes: [], days_until_ready: 7 }));
    render(<WeekPage />);

    expect(await screen.findByText(WEEK_EMPTY_BODY)).toBeInTheDocument();
    expect(screen.getByText("种第一朵玫瑰")).toBeInTheDocument();
    expect(screen.getByText(WEEK_PAGE_TITLE)).toBeInTheDocument();
  });

  it("不满一周只给倒计时，不提前把话摊开", async () => {
    mockGetMyRoses.mockResolvedValue({ data: [roseRow("r1")], total: 1, page: 1, per_page: 100 });
    mockBuildWeekReview.mockResolvedValue(
      review({ total: 1, in_week: 1, ready: false, days_since_first: 3, days_until_ready: 4 }),
    );
    render(<WeekPage />);

    expect(await screen.findByTestId("week-countdown")).toHaveTextContent("还有 4 天");
    expect(screen.getByText(WEEK_PENDING_BODY)).toBeInTheDocument();
    expect(screen.getByText(/第 1 朵是 3 天前种的/)).toBeInTheDocument();
    expect(screen.queryByTestId("week-quote")).toBeNull();
  });

  it("满一周摊开这一周的原话和三类计数", async () => {
    render(<WeekPage />);

    expect(await screen.findByTestId("week-headline")).toHaveTextContent("这一周，你种下了 1 朵玫瑰");
    expect(screen.getByText(WEEK_QUOTES_TITLE)).toBeInTheDocument();
    const quotes = screen.getAllByTestId("week-quote");
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toHaveTextContent("想学陶艺");
    expect(quotes[0]).toHaveTextContent("1 天前");
    expect(screen.getByText(WEEK_READY_FOOTER)).toBeInTheDocument();
    expect(screen.getByText(/感恩 1 · 花苞 1/)).toBeInTheDocument();
  });

  it("这一周没种新花：说实话，并指回我的花圃", async () => {
    mockBuildWeekReview.mockResolvedValue(
      review({ total: 4, in_week: 0, ready: true, quotes: [], counts: { gratitude: 0, anxiety: 0, hope: 0 } }),
    );
    render(<WeekPage />);

    expect(await screen.findByTestId("week-headline")).toHaveTextContent("这一周没有新的玫瑰");
    expect(screen.getByText(WEEK_NO_QUOTES)).toBeInTheDocument();
  });

  it("超过一页时补取最后一页，否则「第 1 朵」会读错日期", async () => {
    mockGetMyRoses
      .mockResolvedValueOnce({ data: [roseRow("new")], total: 250, page: 1, per_page: 100 })
      .mockResolvedValueOnce({ data: [roseRow("old", "2020-01-01T00:00:00Z")], total: 250, page: 3, per_page: 100 });
    render(<WeekPage />);

    await waitFor(() => expect(mockGetMyRoses).toHaveBeenCalledTimes(2));
    expect(mockGetMyRoses).toHaveBeenNthCalledWith(2, 3, 100);
    await waitFor(() => expect(mockBuildWeekReview).toHaveBeenCalled());
    const passed = mockBuildWeekReview.mock.calls[0][0] as { id: string }[];
    expect(passed.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("接口挂了给重试，不留一个转不停的加载中", async () => {
    mockGetMyRoses.mockRejectedValue(new Error("network"));
    render(<WeekPage />);

    expect(await screen.findByText("没能读到这一周。")).toBeInTheDocument();
    expect(screen.getByText("重试")).toBeInTheDocument();
  });

  // 离开超过 30 天（或 refresh token 被撤销）时，接口会 401 并清掉本地 token。
  // 这时该去重新取名，而不是让人对着「没能读到这一周」点重试。
  it("会话过期时直接去登录，不留一个点不动的错误页", async () => {
    mockGetMyRoses.mockRejectedValue(new Error("401"));
    mockGetToken.mockReturnValueOnce("stale-token").mockReturnValue(null);
    render(<WeekPage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByText("重试")).toBeNull();
  });
});

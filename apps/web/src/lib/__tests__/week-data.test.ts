import { loadWeekReview, WEEK_PAGE_SIZE } from "../week-data";

const mockGetMyRoses = jest.fn();
jest.mock("@/lib/api", () => ({
  getMyRoses: (...args: unknown[]) => mockGetMyRoses(...args),
}));

const mockBuildWeekReview = jest.fn();
jest.mock("@/lib/recommend", () => ({
  buildWeekReview: (...args: unknown[]) => mockBuildWeekReview(...args),
}));

const row = (id: string) => ({ id, created_at: "2026-11-18T00:00:00Z", gratitude: "一句" });

const page = (data: { id: string }[], total: number) => ({ data, total, page: 1, per_page: 100 });

describe("loadWeekReview", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildWeekReview.mockResolvedValue({ total: 0, ready: false });
  });

  it("玫瑰不足一页时只请求一次", async () => {
    mockGetMyRoses.mockResolvedValue(page([row("a"), row("b")], 2));

    await loadWeekReview(NOW);

    expect(mockGetMyRoses).toHaveBeenCalledTimes(1);
    expect(mockGetMyRoses).toHaveBeenCalledWith(1, WEEK_PAGE_SIZE);
    expect(mockBuildWeekReview.mock.calls[0][0]).toHaveLength(2);
    expect(mockBuildWeekReview.mock.calls[0][1]).toBe(NOW);
  });

  // 列表按时间倒序：超过一页时「第 1 朵」在最后一页。只读第一页会让
  // 「第 1 朵是几天前」永远算成最近一朵，于是永远差几天到 7 天。
  it("超过一页时补取最后一页，让第 1 朵进得来", async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => row(`new-${i}`));
    mockGetMyRoses
      .mockResolvedValueOnce(page(firstPage, 130))
      .mockResolvedValueOnce(page([row("old-1"), row("old-2")], 130));

    await loadWeekReview(NOW);

    expect(mockGetMyRoses).toHaveBeenCalledTimes(2);
    expect(mockGetMyRoses).toHaveBeenLastCalledWith(2, WEEK_PAGE_SIZE);
    const passed = mockBuildWeekReview.mock.calls[0][0] as { id: string }[];
    expect(passed).toHaveLength(102);
    expect(passed[passed.length - 1].id).toBe("old-2");
  });

  it("正好一页时不多请求一次", async () => {
    mockGetMyRoses.mockResolvedValue(page(Array.from({ length: 100 }, (_, i) => row(`r-${i}`)), 100));

    await loadWeekReview(NOW);

    expect(mockGetMyRoses).toHaveBeenCalledTimes(1);
  });

  // 只取首尾两页时中间是缺的；总数必须以服务端为准，否则页面对种了 250 朵
  // 的人说「总共 200 朵」。
  it("总数以服务端为准，不受只取两页影响", async () => {
    mockGetMyRoses
      .mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, i) => row(`new-${i}`)), 250))
      .mockResolvedValueOnce(page(Array.from({ length: 50 }, (_, i) => row(`old-${i}`)), 250));
    mockBuildWeekReview.mockResolvedValue({ total: 150, ready: true });

    const review = await loadWeekReview(NOW);

    expect(review.total).toBe(250);
  });

  it("服务端总数缺失时不把已有的玫瑰数抹成 0", async () => {
    mockGetMyRoses.mockResolvedValue(page([row("a"), row("b")], 0));
    mockBuildWeekReview.mockResolvedValue({ total: 2, ready: false });

    const review = await loadWeekReview(NOW);

    expect(review.total).toBe(2);
  });

  it("接口失败时抛出，由页面决定怎么显示", async () => {
    mockGetMyRoses.mockRejectedValue(new Error("boom"));

    await expect(loadWeekReview(NOW)).rejects.toThrow("boom");
  });
});

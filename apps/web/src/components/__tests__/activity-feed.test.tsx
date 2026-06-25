import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ActivityFeed } from "../activity-feed";

const mockGetRecentActivity = jest.fn();
const mockFormatDate = jest.fn();
const mockColorEmoji = jest.fn();
const mockColorLabel = jest.fn();

jest.mock("@/lib/api", () => ({
  getRecentActivity: () => mockGetRecentActivity(),
}));

jest.mock("@/lib/recommend", () => ({
  formatDate: (iso: string) => mockFormatDate(iso),
  colorEmoji: (color: string) => mockColorEmoji(color),
  colorLabel: (color: string) => mockColorLabel(color),
}));

describe("ActivityFeed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFormatDate.mockResolvedValue({ relative: "刚刚" });
    mockColorEmoji.mockImplementation((c: string) => ({ red: "🌹", yellow: "💛", white: "🤍" }[c] ?? "🌹"));
    mockColorLabel.mockImplementation((c: string) => ({ red: "红玫瑰", yellow: "黄玫瑰", white: "白玫瑰" }[c] ?? "玫瑰"));
  });

  it("renders a loading pulse initially", () => {
    mockGetRecentActivity.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<ActivityFeed />);
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("renders planted and gifted activities", async () => {
    mockGetRecentActivity.mockResolvedValue([
      { id: "1", kind: "planted", actor: " Alice ", color: "red", created_at: "2026-06-25T00:00:00Z" },
      { id: "2", kind: "gifted", actor: "Bob", color: "yellow", recipient: "Carol", created_at: "2026-06-25T00:00:00Z" },
      { id: "3", kind: "announcement", actor: "欢迎公告", color: "", created_at: "2026-06-25T00:00:00Z" },
    ]);

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText("星空动态")).toBeInTheDocument();
    });
    expect(screen.getByText(/Alice 种下一朵红玫瑰/)).toBeInTheDocument();
    expect(screen.getByText(/Bob 送给 Carol 一朵黄玫瑰/)).toBeInTheDocument();
    expect(screen.getByText("欢迎公告")).toBeInTheDocument();
  });

  it("falls back gracefully when date or color metadata is missing", async () => {
    mockGetRecentActivity.mockResolvedValue([
      { id: "1", kind: "planted", actor: "Someone", color: "blue", created_at: "2026-06-25T00:00:00Z" },
    ]);
    mockFormatDate.mockResolvedValue(null);
    mockColorEmoji.mockReturnValue(undefined);
    mockColorLabel.mockReturnValue(undefined);

    render(<ActivityFeed />);

    await waitFor(() => {
      expect(screen.getByText(/Someone 种下一朵玫瑰/)).toBeInTheDocument();
    });
  });

  it("hides when there are no activities", async () => {
    mockGetRecentActivity.mockResolvedValue([]);
    const { container } = render(<ActivityFeed />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("ignores successful state updates after unmount", async () => {
    let resolve: (value: unknown[]) => void;
    const promise = new Promise((r) => { resolve = r; });
    mockGetRecentActivity.mockReturnValue(promise);

    const { unmount } = render(<ActivityFeed />);
    unmount();

    await act(async () => {
      resolve([{ id: "1", kind: "planted", actor: "A", color: "red", created_at: "2026-06-25T00:00:00Z" }]);
    });
  });

  it("ignores error state updates after unmount", async () => {
    let reject: (reason?: unknown) => void;
    const promise = new Promise((_, r) => { reject = r; });
    mockGetRecentActivity.mockReturnValue(promise);

    const { unmount } = render(<ActivityFeed />);
    unmount();

    await act(async () => {
      reject(new Error("network"));
    });
  });
});

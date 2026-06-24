import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/api", () => ({
  getToken: jest.fn(),
  getUsageStats: jest.fn(),
  getAdminFeedback: jest.fn(),
}));

const { getToken, getUsageStats, getAdminFeedback } = require("@/lib/api") as {
  getToken: jest.Mock;
  getUsageStats: jest.Mock;
  getAdminFeedback: jest.Mock;
};

import StatsPage from "../page";

function mockStats() {
  return {
    total_users: 12,
    total_roses: 30,
    public_roses: 24,
    private_roses: 6,
    total_likes: 7,
    total_feedback: 2,
    users_last_7_days: 3,
    roses_last_7_days: 5,
    feedback_last_7_days: 1,
    latest_rose_at: "2026-06-24T10:00:00Z",
    latest_feedback_at: null,
    user_goal: {
      current: 12,
      goal: 100,
      percent: 12,
    },
  };
}

describe("StatsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getToken.mockReturnValue("admin-token");
    getAdminFeedback.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      per_page: 20,
      total_pages: 0,
    });
  });

  it("redirects anonymous users to login", async () => {
    getToken.mockReturnValue(null);

    render(<StatsPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login?redirect=/stats");
    });
    expect(getUsageStats).not.toHaveBeenCalled();
  });

  it("shows admin usage stats and the 100-user progress", async () => {
    getUsageStats.mockResolvedValue(mockStats());

    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText("12 / 100")).toBeInTheDocument();
    });
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("近 7 天新增用户")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows recent feedback content for admins", async () => {
    getUsageStats.mockResolvedValue(mockStats());
    getAdminFeedback.mockResolvedValue({
      data: [
        {
          id: 1,
          user_id: "u1",
          nickname: "alice",
          content: "我找不到送玫瑰入口",
          created_at: "2026-06-25T10:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
      total_pages: 1,
    });

    render(<StatsPage />);

    await waitFor(() => expect(screen.getByText("我找不到送玫瑰入口")).toBeInTheDocument());
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("keeps stats visible when feedback inbox fails", async () => {
    getUsageStats.mockResolvedValue(mockStats());
    getAdminFeedback.mockRejectedValue(new Error("offline"));

    render(<StatsPage />);

    await waitFor(() => expect(screen.getByText("12 / 100")).toBeInTheDocument());
    expect(screen.getByText("反馈暂时加载失败")).toBeInTheDocument();
  });

  it("shows an error state when stats cannot load", async () => {
    getUsageStats.mockRejectedValue(new Error("offline"));

    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText("数据暂时加载失败")).toBeInTheDocument();
    });
  });

  it("shows forbidden state when user is not an admin", async () => {
    getUsageStats.mockRejectedValue(new Error("STATS_FORBIDDEN"));

    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText("无权限访问应用后台")).toBeInTheDocument();
    });
  });
});

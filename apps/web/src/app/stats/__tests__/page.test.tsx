import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/lib/api", () => ({
  getUsageStats: jest.fn(),
}));

const { getUsageStats } = require("@/lib/api") as {
  getUsageStats: jest.Mock;
};

import StatsPage from "../page";

describe("StatsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows public usage stats and the 100-user progress", async () => {
    getUsageStats.mockResolvedValue({
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
    });

    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText("12 / 100")).toBeInTheDocument();
    });
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("近 7 天新增用户")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows an error state when stats cannot load", async () => {
    getUsageStats.mockRejectedValue(new Error("offline"));

    render(<StatsPage />);

    await waitFor(() => {
      expect(screen.getByText("数据暂时加载失败")).toBeInTheDocument();
    });
  });
});

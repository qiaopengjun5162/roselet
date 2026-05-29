import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/api", () => ({
  getUserProfile: jest.fn(),
  getToken: jest.fn().mockReturnValue("jwt-token"),
}));

const { getUserProfile, getToken } = require("@/lib/api") as {
  getUserProfile: jest.Mock;
  getToken: jest.Mock;
};

import ProfilePage from "../page";

describe("ProfilePage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should show loading state", () => {
    getToken.mockReturnValue("jwt-token");
    getUserProfile.mockReturnValue(new Promise(() => {}));
    render(<ProfilePage />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("should display user profile", async () => {
    getToken.mockReturnValue("jwt-token");
    getUserProfile.mockResolvedValue({
      user: { id: "u1", nickname: "alice", created_at: "2026-01-01" },
      total_roses: 5,
      red_count: 2,
      white_count: 2,
      yellow_count: 1,
    });
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
    });
  });

  it("should show error on failure", async () => {
    getToken.mockReturnValue("jwt-token");
    getUserProfile.mockRejectedValue(new Error("fail"));
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("加载资料失败")).toBeInTheDocument();
    });
  });
});

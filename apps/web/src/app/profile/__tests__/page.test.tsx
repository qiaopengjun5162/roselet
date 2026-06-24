import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/api", () => ({
  deactivateAccount: jest.fn(),
  getUserProfile: jest.fn(),
  getToken: jest.fn().mockReturnValue("jwt-token"),
}));

const { deactivateAccount, getUserProfile, getToken } = require("@/lib/api") as {
  deactivateAccount: jest.Mock;
  getUserProfile: jest.Mock;
  getToken: jest.Mock;
};

import ProfilePage from "../page";

describe("ProfilePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn().mockReturnValue(true);
  });

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
    expect(screen.getByText("u1")).toBeInTheDocument();
  });

  it("should show error on failure", async () => {
    getToken.mockReturnValue("jwt-token");
    getUserProfile.mockRejectedValue(new Error("fail"));
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText("加载资料失败")).toBeInTheDocument();
    });
  });

  it("should redirect to login when auth state is cleared after failure", async () => {
    getToken.mockReturnValueOnce("jwt-token").mockReturnValueOnce(null);
    getUserProfile.mockRejectedValue(new Error("auth failed"));
    render(<ProfilePage />);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("should deactivate account and redirect to login", async () => {
    getToken.mockReturnValue("jwt-token");
    getUserProfile.mockResolvedValue({
      user: { id: "u1", nickname: "alice", created_at: "2026-01-01" },
      total_roses: 5,
      red_count: 2,
      white_count: 2,
      yellow_count: 1,
    });
    deactivateAccount.mockResolvedValue({
      success: true,
      restore_deadline: "2026-07-23T00:00:00Z",
    });

    render(<ProfilePage />);

    const button = await screen.findByRole("button", { name: "注销账号" });
    button.click();

    await waitFor(() => {
      expect(deactivateAccount).toHaveBeenCalledWith("user_requested");
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });
});

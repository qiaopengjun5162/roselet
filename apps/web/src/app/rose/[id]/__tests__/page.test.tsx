import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: "rose-1" }),
}));

jest.mock("next/link", () => {
  return ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  );
});

jest.mock("@/lib/api", () => ({
  getRose: jest.fn(),
  updateRose: jest.fn(),
  deleteRose: jest.fn(),
  getUser: jest.fn(),
  toggleLike: jest.fn(),
}));

jest.mock("@/lib/sound", () => ({
  playClick: jest.fn(),
  playPlant: jest.fn(),
  playLike: jest.fn(),
}));

const { getRose, updateRose, deleteRose, getUser, toggleLike } = require("@/lib/api") as {
  getRose: jest.Mock;
  updateRose: jest.Mock;
  deleteRose: jest.Mock;
  getUser: jest.Mock;
  toggleLike: jest.Mock;
};

import RoseDetailPage from "../page";

const mockRose = {
  id: "rose-1",
  color: "red",
  gratitude: "感恩社区",
  anxiety: "工作压力",
  hope: "期待旅行",
  user_id: "u1",
  nickname: "alice",
  like_count: 3,
  ai_reply: "AI says hello",
  created_at: "2026-01-01T00:00:00Z",
};

describe("RoseDetailPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should show loading state", () => {
    getRose.mockReturnValue(new Promise(() => {}));
    getUser.mockReturnValue(null);
    render(<RoseDetailPage />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("should show error on failure", async () => {
    getRose.mockRejectedValue(new Error("not found"));
    getUser.mockReturnValue(null);
    render(<RoseDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("玫瑰不存在")).toBeInTheDocument();
    });
  });

  it("should display rose details", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u2", nickname: "bob" });
    render(<RoseDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("红玫瑰")).toBeInTheDocument();
      expect(screen.getByText("感恩社区")).toBeInTheDocument();
      expect(screen.getByText("工作压力")).toBeInTheDocument();
      expect(screen.getByText("期待旅行")).toBeInTheDocument();
      expect(screen.getByText("alice")).toBeInTheDocument();
    });
  });

  it("should show AI reply", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u2" });
    render(<RoseDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("AI says hello")).toBeInTheDocument();
    });
  });

  it("should show edit/delete buttons for owner", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    render(<RoseDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("编辑")).toBeInTheDocument();
      expect(screen.getByText("删除")).toBeInTheDocument();
    });
  });

  it("should not show edit/delete for non-owner", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u2", nickname: "bob" });
    render(<RoseDetailPage />);
    await waitFor(() => {
      expect(screen.queryByText("编辑")).not.toBeInTheDocument();
      expect(screen.queryByText("删除")).not.toBeInTheDocument();
    });
  });

  it("should toggle like", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u2" });
    toggleLike.mockResolvedValue({ liked: true, like_count: 4 });
    render(<RoseDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("❤️ 3")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("❤️ 3"));
    await waitFor(() => {
      expect(toggleLike).toHaveBeenCalledWith("rose-1");
    });
  });

  it("should enter edit mode", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    render(<RoseDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("编辑")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("编辑"));
    expect(screen.getByText("保存")).toBeInTheDocument();
    expect(screen.getByText("取消")).toBeInTheDocument();
  });

  it("should call deleteRose", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    deleteRose.mockResolvedValue(undefined);
    window.confirm = jest.fn().mockReturnValue(true);
    render(<RoseDetailPage />);
    await waitFor(() => {
      expect(screen.getByText("删除")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("删除"));
    await waitFor(() => {
      expect(deleteRose).toHaveBeenCalledWith("rose-1");
      expect(mockPush).toHaveBeenCalledWith("/garden");
    });
  });
});

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
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
const { playClick, playPlant, playLike } = require("@/lib/sound") as {
  playClick: jest.Mock;
  playPlant: jest.Mock;
  playLike: jest.Mock;
};

import { RoseDetailClient } from "../client";
import { generateStaticParams } from "../page";

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

  describe("generateStaticParams", () => {
    const oldApiUrl = process.env.NEXT_PUBLIC_API_URL;

    afterEach(() => {
      process.env.NEXT_PUBLIC_API_URL = oldApiUrl;
      jest.restoreAllMocks();
    });

    it("includes a placeholder shell for Cloudflare Pages fallback", async () => {
      process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: "rose-1" }, { id: "rose-2" }] }),
      } as Response);

      await expect(generateStaticParams()).resolves.toEqual([
        { id: "rose-1" },
        { id: "rose-2" },
        { id: "placeholder" },
      ]);
    });
  });

  it("should show loading state", () => {
    getRose.mockReturnValue(new Promise(() => {}));
    getUser.mockReturnValue(null);
    render(<RoseDetailClient id="rose-1" />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("should show error on failure", async () => {
    getRose.mockRejectedValue(new Error("not found"));
    getUser.mockReturnValue(null);
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.getByText("玫瑰不存在")).toBeInTheDocument();
    });
  });

  it("should display rose details", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u2", nickname: "bob" });
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.getByText("红玫瑰")).toBeInTheDocument();
      expect(screen.getByText("感恩社区")).toBeInTheDocument();
      expect(screen.getByText("工作压力")).toBeInTheDocument();
      expect(screen.getByText("期待旅行")).toBeInTheDocument();
      expect(screen.getByText("alice")).toBeInTheDocument();
    });
  });

  it("uses the browser path id when rendered from the Cloudflare placeholder shell", async () => {
    const oldPath = window.location.pathname;
    window.history.pushState({}, "", "/rose/real-cloudflare-id");
    getRose.mockResolvedValue({ ...mockRose, id: "real-cloudflare-id" });
    getUser.mockReturnValue({ id: "u2", nickname: "bob" });

    render(<RoseDetailClient id="placeholder" />);

    await waitFor(() => {
      expect(getRose).toHaveBeenCalledWith("real-cloudflare-id");
      expect(screen.getByText("红玫瑰")).toBeInTheDocument();
    });

    window.history.pushState({}, "", oldPath);
  });

  it("should show AI reply", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u2" });
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.getByText("AI says hello")).toBeInTheDocument();
    });
  });

  it("should show edit/delete buttons for owner", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.getByText("编辑")).toBeInTheDocument();
      expect(screen.getByText("删除")).toBeInTheDocument();
    });
  });

  it("should not show edit/delete for non-owner", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u2", nickname: "bob" });
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.queryByText("编辑")).not.toBeInTheDocument();
      expect(screen.queryByText("删除")).not.toBeInTheDocument();
    });
  });

  it("should toggle like", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u2" });
    toggleLike.mockResolvedValue({ liked: true, like_count: 4 });
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.getByText("❤️ 3")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("❤️ 3"));
    await waitFor(() => {
      expect(toggleLike).toHaveBeenCalledWith("rose-1");
    });
    expect(playLike).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText("❤️ 4")).toBeInTheDocument();
    });
  });

  it("should enter edit mode", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.getByText("编辑")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("编辑"));
    expect(screen.getByText("保存")).toBeInTheDocument();
    expect(screen.getByText("取消")).toBeInTheDocument();
    expect(playClick).toHaveBeenCalledTimes(1);
  });

  it("should save edits", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    updateRose.mockResolvedValue({
      ...mockRose,
      color: "white",
      gratitude: "更新感恩",
      anxiety: null,
      hope: "新的期待",
    });

    render(<RoseDetailClient id="rose-1" />);

    await waitFor(() => expect(screen.getByText("编辑")).toBeInTheDocument());
    fireEvent.click(screen.getByText("编辑"));
    fireEvent.click(screen.getByText("🤍 白玫瑰"));

    const textareas = screen.getAllByRole("textbox");
    fireEvent.change(textareas[0], { target: { value: "更新感恩" } });
    fireEvent.change(textareas[1], { target: { value: "" } });
    fireEvent.change(textareas[2], { target: { value: "新的期待" } });
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => {
      expect(updateRose).toHaveBeenCalledWith("rose-1", {
        color: "white",
        gratitude: "更新感恩",
        anxiety: null,
        hope: "新的期待",
      });
    });
    expect(playPlant).toHaveBeenCalledTimes(1);
    expect(screen.getByText("更新感恩")).toBeInTheDocument();
  });

  it("should show save error", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    updateRose.mockRejectedValue(new Error("nope"));

    render(<RoseDetailClient id="rose-1" />);

    await waitFor(() => expect(screen.getByText("编辑")).toBeInTheDocument());
    fireEvent.click(screen.getByText("编辑"));
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() => expect(screen.getByText("保存失败")).toBeInTheDocument());
  });

  it("should cancel delete when confirm returns false", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    window.confirm = jest.fn().mockReturnValue(false);

    render(<RoseDetailClient id="rose-1" />);

    await waitFor(() => expect(screen.getByText("删除")).toBeInTheDocument());
    fireEvent.click(screen.getByText("删除"));

    expect(deleteRose).not.toHaveBeenCalled();
  });

  it("should show delete error", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    deleteRose.mockRejectedValue(new Error("nope"));
    window.confirm = jest.fn().mockReturnValue(true);

    render(<RoseDetailClient id="rose-1" />);

    await waitFor(() => expect(screen.getByText("删除")).toBeInTheDocument());
    fireEvent.click(screen.getByText("删除"));

    await waitFor(() => expect(screen.getByText("删除失败")).toBeInTheDocument());
  });

  it("should redirect anonymous likes to login", async () => {
    getRose.mockResolvedValue({ ...mockRose, like_count: 0 });
    getUser.mockReturnValue(null);

    render(<RoseDetailClient id="rose-1" />);

    await waitFor(() => expect(screen.getByText("❤️ 点赞")).toBeInTheDocument());
    fireEvent.click(screen.getByText("❤️ 点赞"));

    expect(mockPush).toHaveBeenCalledWith("/login?redirect=/rose/rose-1");
    expect(toggleLike).not.toHaveBeenCalled();
  });

  it("should call deleteRose", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    deleteRose.mockResolvedValue(undefined);
    window.confirm = jest.fn().mockReturnValue(true);
    render(<RoseDetailClient id="rose-1" />);
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

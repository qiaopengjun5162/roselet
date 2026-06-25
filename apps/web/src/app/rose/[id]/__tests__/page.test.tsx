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
  getUser: jest.fn(),
  toggleLike: jest.fn(),
}));

jest.mock("@/lib/sound", () => ({
  playClick: jest.fn(),
  playPlant: jest.fn(),
  playLike: jest.fn(),
}));

const { getRose, updateRose, getUser, toggleLike } = require("@/lib/api") as {
  getRose: jest.Mock;
  updateRose: jest.Mock;
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
  is_private: false,
  recipient_nickname: null,
  is_gift: false,
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

  it("should show rose settings for owner", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "玫瑰设置" })).toBeInTheDocument();
    });
    expect(screen.queryByText("编辑")).not.toBeInTheDocument();
    expect(screen.queryByText("删除")).not.toBeInTheDocument();
  });

  it("should not show rose settings for non-owner", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u2", nickname: "bob" });
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "玫瑰设置" })).not.toBeInTheDocument();
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

  it("should open rose settings", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    render(<RoseDetailClient id="rose-1" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "玫瑰设置" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "玫瑰设置" }));
    expect(screen.getByText("种下后的文字会保留下来，不再改写；这里先放只影响可见性的设置。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "设为私密" })).toBeInTheDocument();
    expect(screen.getByText("送给别人")).toBeInTheDocument();
    expect(playClick).toHaveBeenCalledTimes(1);
  });

  it("should make a public rose private", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    updateRose.mockResolvedValue({
      ...mockRose,
      is_private: true,
    });

    render(<RoseDetailClient id="rose-1" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "玫瑰设置" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "玫瑰设置" }));
    fireEvent.click(screen.getByRole("button", { name: "设为私密" }));

    await waitFor(() => {
      expect(updateRose).toHaveBeenCalledWith("rose-1", {
        is_private: true,
      });
    });
    expect(playPlant).toHaveBeenCalledTimes(1);
    expect(screen.getByText("感恩社区")).toBeInTheDocument();
  });

  it("should show private status instead of a private action", async () => {
    getRose.mockResolvedValue({ ...mockRose, is_private: true });
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });

    render(<RoseDetailClient id="rose-1" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "玫瑰设置" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "玫瑰设置" }));

    expect(screen.getByText("已私密")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "设为私密" })).not.toBeInTheDocument();
  });

  it("should show settings error", async () => {
    getRose.mockResolvedValue(mockRose);
    getUser.mockReturnValue({ id: "u1", nickname: "alice" });
    updateRose.mockRejectedValue(new Error("nope"));

    render(<RoseDetailClient id="rose-1" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "玫瑰设置" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "玫瑰设置" }));
    fireEvent.click(screen.getByRole("button", { name: "设为私密" }));

    await waitFor(() => expect(screen.getByText("设置失败")).toBeInTheDocument());
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

});

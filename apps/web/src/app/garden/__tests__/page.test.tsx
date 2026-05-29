import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/link", () => {
  return ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  );
});

jest.mock("@/lib/api", () => ({
  getGarden: jest.fn(),
}));

jest.mock("@/lib/ws", () => ({
  connectGardenWs: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("@/lib/sound", () => ({
  playNotify: jest.fn(),
}));

const { getGarden } = require("@/lib/api") as { getGarden: jest.Mock };

import GardenPage from "../page";

describe("GardenPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should show loading state", () => {
    getGarden.mockReturnValue(new Promise(() => {}));
    render(<GardenPage />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("should show empty state", async () => {
    getGarden.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
    render(<GardenPage />);
    await waitFor(() => {
      expect(screen.getByText("花圃还是空的")).toBeInTheDocument();
    });
  });

  it("should display roses", async () => {
    getGarden.mockResolvedValue({
      data: [
        { id: "r1", color: "red", gratitude: "感恩社区", anxiety: null, hope: null, user_id: null, nickname: null, like_count: 0, ai_reply: null, created_at: "" },
      ],
      total: 1,
      page: 1,
      per_page: 20,
    });
    render(<GardenPage />);
    await waitFor(() => {
      expect(screen.getByText("感恩社区")).toBeInTheDocument();
      expect(screen.getByText("共 1 朵玫瑰")).toBeInTheDocument();
    });
  });

  it("should show filter buttons", async () => {
    getGarden.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
    render(<GardenPage />);
    await waitFor(() => {
      expect(screen.getByText("全部")).toBeInTheDocument();
      expect(screen.getByText("红玫瑰")).toBeInTheDocument();
      expect(screen.getByText("白玫瑰")).toBeInTheDocument();
      expect(screen.getByText("黄玫瑰")).toBeInTheDocument();
    });
  });

  it("should call getGarden with color filter", async () => {
    getGarden.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
    render(<GardenPage />);
    await waitFor(() => {
      expect(getGarden).toHaveBeenCalledWith(1, 20, undefined);
    });
    fireEvent.click(screen.getByText("红玫瑰"));
    await waitFor(() => {
      expect(getGarden).toHaveBeenCalledWith(1, 20, "red");
    });
  });
});

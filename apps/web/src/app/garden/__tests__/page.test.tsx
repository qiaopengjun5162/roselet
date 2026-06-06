import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/rose-card", () => ({
  RoseCard: ({ rose }: { rose: { gratitude?: string; nickname?: string } }) => (
    <div>{rose.gratitude && <span>{rose.gratitude}</span>}{rose.nickname && <span>{rose.nickname}</span>}</div>
  ),
}));

jest.mock("next/link", () =>
  function Link({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  }
);

const mockGetGarden = jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
jest.mock("@/lib/api", () => ({ getGarden: mockGetGarden }));

const mockLoadGardenCache = jest.fn().mockResolvedValue(null);
jest.mock("@/lib/garden-cache", () => ({ loadGardenCache: mockLoadGardenCache }));

const mockConnectGardenWs = jest.fn();
jest.mock("@/lib/ws", () => ({ connectGardenWs: mockConnectGardenWs }));
const mockPlayNotify = jest.fn();
jest.mock("@/lib/sound", () => ({ playNotify: mockPlayNotify }));

import GardenPage from "../page";

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGarden.mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 });
  mockLoadGardenCache.mockResolvedValue(null);
  mockConnectGardenWs.mockReturnValue(() => {});
});

describe("GardenPage", () => {
  it("shows loading state", () => {
    render(<GardenPage />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("shows empty state after load", async () => {
    render(<GardenPage />);
    await waitFor(() => {
      expect(screen.getByText("花圃还是空的，去种一朵花吧")).toBeInTheDocument();
    });
  });

  it("displays roses from API", async () => {
    mockGetGarden.mockResolvedValue({ data: [{ id: "1", color: "red", gratitude: "感恩社区", is_private: false }], total: 1, page: 1, per_page: 20 });
    render(<GardenPage />);
    await waitFor(() => {
      expect(screen.getByText("感恩社区")).toBeInTheDocument();
    });
  });

  it("hydrates from IndexedDB cache before network result", async () => {
    mockLoadGardenCache.mockResolvedValue({
      roses: [{ id: "cached", color: "yellow", gratitude: "缓存玫瑰", is_private: false }],
      total: 1,
      page: 1,
      filter: "",
      updated_at: "2026-06-06T00:00:00Z",
    });
    mockGetGarden.mockReturnValue(new Promise(() => {}));
    render(<GardenPage />);
    await waitFor(() => {
      expect(screen.getByText("缓存玫瑰")).toBeInTheDocument();
    });
  });

  it("calls getGarden with color filter", async () => {
    render(<GardenPage />);
    await waitFor(() => expect(screen.queryByText("加载中...")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("红玫瑰"));
    await waitFor(() => {
      expect(mockGetGarden).toHaveBeenCalledWith(1, 20, "red");
    });
  });

  it("appends roses received from WebSocket", async () => {
    let onRose: ((rose: { id: string; color: string; gratitude: string; is_private: boolean }) => void) | null = null;
    mockConnectGardenWs.mockImplementation((callback: typeof onRose) => {
      onRose = callback;
      return () => {};
    });

    render(<GardenPage />);
    await waitFor(() => expect(screen.queryByText("加载中...")).not.toBeInTheDocument());
    act(() => {
      onRose?.({ id: "ws-1", color: "white", gratitude: "实时玫瑰", is_private: false });
    });

    expect(screen.getByText("实时玫瑰")).toBeInTheDocument();
    expect(mockPlayNotify).toHaveBeenCalled();
  });

  it("loads more roses", async () => {
    mockGetGarden
      .mockResolvedValueOnce({
        data: [{ id: "1", color: "red", gratitude: "第一页", is_private: false }],
        total: 21,
        page: 1,
        per_page: 20,
      })
      .mockResolvedValueOnce({
        data: [{ id: "2", color: "yellow", gratitude: "第二页", is_private: false }],
        total: 21,
        page: 2,
        per_page: 20,
      });

    render(<GardenPage />);
    await waitFor(() => expect(screen.getByText("第一页")).toBeInTheDocument());
    fireEvent.click(screen.getByText("加载更多"));

    await waitFor(() => expect(screen.getByText("第二页")).toBeInTheDocument());
    expect(mockGetGarden).toHaveBeenCalledWith(2, 20, undefined);
  });
});

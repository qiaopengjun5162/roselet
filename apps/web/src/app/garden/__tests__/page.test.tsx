import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

jest.mock("@/lib/ws", () => ({ connectGardenWs: jest.fn().mockReturnValue(() => {}) }));
jest.mock("@/lib/sound", () => ({ playNotify: jest.fn() }));

import GardenPage from "../page";

beforeEach(() => jest.clearAllMocks());

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

  it("calls getGarden with color filter", async () => {
    render(<GardenPage />);
    await waitFor(() => expect(screen.queryByText("加载中...")).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("红玫瑰"));
    await waitFor(() => {
      expect(mockGetGarden).toHaveBeenCalledWith(1, 20, "red");
    });
  });
});

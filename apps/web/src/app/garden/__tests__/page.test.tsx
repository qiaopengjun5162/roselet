import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/components/rose-card", () => ({
  RoseCard: ({ rose }: { rose: { gratitude?: string; nickname?: string } }) => (
    <div>
      {rose.gratitude && <span>{rose.gratitude}</span>}
      {rose.nickname && <span>{rose.nickname}</span>}
    </div>
  ),
}));

jest.mock("next/link", () =>
  function Link({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) {
    return <a href={href} {...props}>{children}</a>;
  }
);

jest.mock("@/lib/api", () => ({
  getGarden: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, per_page: 20 }),
}));

jest.mock("@/lib/ws", () => ({
  connectGardenWs: jest.fn().mockReturnValue(() => {}),
}));

jest.mock("@/lib/sound", () => ({
  playNotify: jest.fn(),
}));

// Store mock — returns controlled state for each test
let storeState = { items: [] as any[], total: 0, hasMore: false, loading: true, error: null as string | null, filter: "all" };
const mockDispatch = jest.fn();
jest.mock("@/lib/useWasmStore", () => ({
  useWasmStore: () => ({
    ...storeState,
    dispatch: mockDispatch,
    ready: storeState.ready,
  }),
}));

import GardenPage from "../page";
import { getGarden } from "@/lib/api";

beforeEach(() => {
  jest.clearAllMocks();
  storeState = { items: [], total: 0, hasMore: false, loading: true, error: null, filter: "all" };
});

describe("GardenPage", () => {
  it("should show loading state", () => {
    render(<GardenPage />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("should show empty state", () => {
    storeState.loading = false;
    render(<GardenPage />);
    expect(screen.getByText("花圃还是空的，去种一朵花吧")).toBeInTheDocument();
  });

  it("should display roses", () => {
    storeState.loading = false;
    storeState.items = [{ id: "1", color: "red", gratitude: "感恩社区" }];
    render(<GardenPage />);
    expect(screen.getByText("感恩社区")).toBeInTheDocument();
  });

  it("should call getGarden with color filter", async () => {
    storeState.loading = false;
    render(<GardenPage />);
    const redBtn = screen.getByText("红玫瑰");
    fireEvent.click(redBtn);
    // Clicking 红玫瑰 dispatches set_filter action
    expect(mockDispatch).toHaveBeenCalledWith({ type: "set_filter", filter: "red" });
  });

  it("should show Rust badge when WASM ready", () => {
    storeState.loading = false;
    storeState.ready = true;
    render(<GardenPage />);
    expect(screen.getByText("⚡Rust")).toBeInTheDocument();
  });
});

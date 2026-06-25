import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TipTicker } from "../tip-ticker";

const mockGetTips = jest.fn();

jest.mock("@/lib/recommend", () => ({
  getTips: (...args: unknown[]) => mockGetTips(...args),
}));

describe("TipTicker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTips.mockResolvedValue([{ text: "可以不设密码，像把钥匙藏在花盆底下。" }]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders tips for the requested context", async () => {
    render(<TipTicker context="login" />);

    await waitFor(() => {
      expect(screen.getByText(/可以不设密码/)).toBeInTheDocument();
    });
    expect(mockGetTips).toHaveBeenCalledWith("login");
  });

  it("rotates through multiple tips and cleans up on unmount", async () => {
    jest.useFakeTimers();
    mockGetTips.mockResolvedValue([
      { text: "first tip" },
      { text: "second tip" },
    ]);

    const { unmount } = render(<TipTicker context="home" />);

    await waitFor(() => {
      expect(screen.getByText("first tip")).toBeInTheDocument();
    });

    act(() => {
      jest.advanceTimersByTime(5200);
    });

    await waitFor(() => {
      expect(screen.getByText("second tip")).toBeInTheDocument();
    });

    unmount();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
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

  it("renders tips for the requested context", async () => {
    render(<TipTicker context="login" />);

    await waitFor(() => {
      expect(screen.getByText(/可以不设密码/)).toBeInTheDocument();
    });
    expect(mockGetTips).toHaveBeenCalledWith("login");
  });
});

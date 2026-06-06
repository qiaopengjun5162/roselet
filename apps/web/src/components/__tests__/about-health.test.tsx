import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AboutHealth } from "../about-health";

const mockGetHealth = jest.fn();

jest.mock("@/lib/api", () => ({
  getHealth: () => mockGetHealth(),
}));

describe("AboutHealth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders backend health and version", async () => {
    mockGetHealth.mockResolvedValue({ status: "ok", database: "healthy", version: "0.1.0" });
    render(<AboutHealth />);

    expect(screen.getByText("正在读取 /health")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("花圃服务正常")).toBeInTheDocument();
    });
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("healthy")).toBeInTheDocument();
  });

  it("can retry after health loading fails", async () => {
    mockGetHealth
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ status: "degraded", database: "unhealthy", version: "0.1.1" });

    render(<AboutHealth />);
    await waitFor(() => {
      expect(screen.getByText("暂时无法读取后端状态")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => {
      expect(screen.getByText("花圃服务降级")).toBeInTheDocument();
    });
    expect(screen.getByText("0.1.1")).toBeInTheDocument();
  });
});

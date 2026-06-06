// RosePlayer 在成功页 autoPlay，需要 mock AudioContext
global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn().mockReturnValue({
    type: "sine", frequency: { value: 0 },
    connect: jest.fn(), start: jest.fn(), stop: jest.fn(),
    onended: null,
  }),
  createGain: jest.fn().mockReturnValue({ gain: { value: 0 }, connect: jest.fn() }),
  createAnalyser: jest.fn().mockReturnValue({
    fftSize: 256, frequencyBinCount: 128,
    connect: jest.fn(), getFloatTimeDomainData: jest.fn(),
  }),
  createDelay: jest.fn().mockReturnValue({ delayTime: { value: 0 }, connect: jest.fn() }),
  createChannelMerger: jest.fn().mockReturnValue({ connect: jest.fn() }),
  destination: {},
  close: jest.fn().mockResolvedValue(undefined),
})) as unknown as typeof AudioContext;

global.requestAnimationFrame = jest.fn().mockReturnValue(1);
global.cancelAnimationFrame = jest.fn();

HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  fillStyle: "", strokeStyle: "", lineWidth: 0, shadowBlur: 0,
  shadowColor: "", lineCap: "", fillRect: jest.fn(),
  beginPath: jest.fn(), moveTo: jest.fn(), lineTo: jest.fn(), stroke: jest.fn(),
});

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock("@/lib/api", () => ({
  createRose: jest.fn(),
  getMyRoses: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  getToken: jest.fn().mockReturnValue("jwt-token"),
}));

jest.mock("@/lib/recommend", () => ({
  getRecommendation: jest.fn().mockResolvedValue(null),
  validatePlantInput: jest.fn().mockResolvedValue({ valid: true, error: null, cleaned: null }),
  getFireworkLaunches: jest.fn().mockResolvedValue([]),
  burstFireworks: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/lib/sound", () => ({
  playClick: jest.fn(),
  playPlant: jest.fn(),
  playComplete: jest.fn(),
}));

jest.mock("@/components/rose-player", () => ({
  RosePlayer: () => <div data-testid="rose-player" />,
}));


const { createRose } = require("@/lib/api") as { createRose: jest.Mock };
import PlantPage from "../page";

describe("PlantPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should render color selection step", () => {
    render(<PlantPage />);
    expect(screen.getByText("选择玫瑰的颜色")).toBeInTheDocument();
    expect(screen.getByText("红玫瑰")).toBeInTheDocument();
    expect(screen.getByText("白玫瑰")).toBeInTheDocument();
    expect(screen.getByText("黄玫瑰")).toBeInTheDocument();
  });

  it("should navigate to interactive step on color click", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    expect(screen.getByText(/种下你的玫瑰/)).toBeInTheDocument();
  });

  it("should show hotspot buttons", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    // Hotspot buttons are accessible by role
    expect(screen.getByRole("button", { name: "🌹" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🌵" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🌱" })).toBeInTheDocument();
  });

  it("should open dialog on gratitude hotspot click", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.click(screen.getByRole("button", { name: "🌹" }));
    // Dialog should appear with textarea
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(screen.getByText("玫瑰")).toBeInTheDocument(); // dialog title
  });

  it("should fill and auto-submit on dialog confirm", async () => {
    createRose.mockResolvedValue({ id: "r1", color: "red" });
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.click(screen.getByRole("button", { name: "🌹" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "感恩测试" } });
    fireEvent.click(screen.getByText("确定并种下"));
    await waitFor(() => {
      expect(createRose).toHaveBeenCalled();
      expect(screen.getByText("已种入星空花圃")).toBeInTheDocument();
    });
  });

  it("should show error on submit failure", async () => {
    createRose.mockRejectedValue(new Error("fail"));
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.click(screen.getByRole("button", { name: "🌹" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "感恩" } });
    fireEvent.click(screen.getByText("确定并种下"));
    await waitFor(() => {
      expect(screen.getByText("提交失败，请重试")).toBeInTheDocument();
    });
  });

  it("should go back to color step", () => {
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.click(screen.getByText("换颜色"));
    expect(screen.getByText("选择玫瑰的颜色")).toBeInTheDocument();
  });

  it("should allow planting another rose after success", async () => {
    createRose.mockResolvedValue({ id: "r1", color: "red" });
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.click(screen.getByRole("button", { name: "🌹" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "感恩" } });
    fireEvent.click(screen.getByText("确定并种下"));
    await waitFor(() => {
      expect(screen.getByText("再种一朵")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("再种一朵"));
    expect(screen.getByText("选择玫瑰的颜色")).toBeInTheDocument();
  });

  it("should view garden after success", async () => {
    createRose.mockResolvedValue({ id: "r1", color: "red" });
    render(<PlantPage />);
    fireEvent.click(screen.getByText("红玫瑰"));
    fireEvent.click(screen.getByRole("button", { name: "🌹" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "感恩" } });
    fireEvent.click(screen.getByText("确定并种下"));
    await waitFor(() => {
      expect(screen.getByText("查看花圃")).toBeInTheDocument();
    });
  });
});

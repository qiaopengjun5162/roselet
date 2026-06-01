import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Web Audio API mock
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockClose = jest.fn().mockResolvedValue(undefined);
const mockConnect = jest.fn().mockReturnThis();
const mockGetFloatTimeDomainData = jest.fn((buf: Float32Array) => buf.fill(0));

const mockOscillator = {
  type: "sine",
  frequency: { value: 0 },
  connect: mockConnect,
  start: mockStart,
  stop: mockStop,
};
const mockGain = { gain: { value: 0 }, connect: mockConnect };
const mockAnalyser = {
  fftSize: 512,
  frequencyBinCount: 256,
  connect: mockConnect,
  getFloatTimeDomainData: mockGetFloatTimeDomainData,
};
const mockDelay = { delayTime: { value: 0 }, connect: mockConnect };
const mockMerger = { connect: mockConnect };

global.AudioContext = jest.fn().mockImplementation(() => ({
  createOscillator: jest.fn().mockReturnValue(mockOscillator),
  createGain: jest.fn().mockReturnValue(mockGain),
  createAnalyser: jest.fn().mockReturnValue(mockAnalyser),
  createDelay: jest.fn().mockReturnValue(mockDelay),
  createChannelMerger: jest.fn().mockReturnValue(mockMerger),
  destination: {},
  close: mockClose,
})) as unknown as typeof AudioContext;

// Canvas mock
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 0,
  shadowBlur: 0,
  shadowColor: "",
  lineCap: "",
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
});

global.requestAnimationFrame = jest.fn().mockReturnValue(1);
global.cancelAnimationFrame = jest.fn();

import OscilloscopePage from "../page";

describe("OscilloscopePage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders title and subtitle", () => {
    render(<OscilloscopePage />);
    expect(screen.getByText("情绪示波器")).toBeInTheDocument();
    expect(screen.getByText(/每种情绪都有自己的形状/)).toBeInTheDocument();
  });

  it("renders all preset buttons", () => {
    render(<OscilloscopePage />);
    expect(screen.getByText("同频共振")).toBeInTheDocument();
    expect(screen.getByText("感恩之心")).toBeInTheDocument();
    expect(screen.getByText("尖刺之美")).toBeInTheDocument();
  });

  it("renders all waveform buttons", () => {
    render(<OscilloscopePage />);
    expect(screen.getByText("sine")).toBeInTheDocument();
    expect(screen.getByText("sawtooth")).toBeInTheDocument();
    expect(screen.getByText("triangle")).toBeInTheDocument();
    expect(screen.getByText("square")).toBeInTheDocument();
  });

  it("shows start button initially", () => {
    render(<OscilloscopePage />);
    expect(screen.getByText("▶ 开始感受")).toBeInTheDocument();
  });

  it("switches to stop button after clicking start", () => {
    render(<OscilloscopePage />);
    fireEvent.click(screen.getByText("▶ 开始感受"));
    expect(screen.getByText("■ 停止")).toBeInTheDocument();
    expect(mockStart).toHaveBeenCalledTimes(2); // left + right osc
  });

  it("stops audio and shows start button after clicking stop", () => {
    render(<OscilloscopePage />);
    fireEvent.click(screen.getByText("▶ 开始感受"));
    fireEvent.click(screen.getByText("■ 停止"));
    expect(screen.getByText("▶ 开始感受")).toBeInTheDocument();
    expect(mockClose).toHaveBeenCalled();
  });

  it("switches preset and shows emotion description", () => {
    render(<OscilloscopePage />);
    fireEvent.click(screen.getByText("焦虑与静"));
    expect(screen.getByText("尖刺与柔软的交织，寻找平衡")).toBeInTheDocument();
  });

  it("renders canvas element", () => {
    render(<OscilloscopePage />);
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas?.width).toBe(460);
    expect(canvas?.height).toBe(380);
  });

  it("renders all three sliders", () => {
    render(<OscilloscopePage />);
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(3);
  });

  it("shows oscilloscope tip text", () => {
    render(<OscilloscopePage />);
    expect(screen.getByText(/L=CH1 R=CH2/)).toBeInTheDocument();
  });
});

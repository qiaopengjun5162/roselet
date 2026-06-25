import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RosePlayer } from "../rose-player";
import type { Rose } from "@/lib/api";

const mockRoseToSoundParams = jest.fn();
const mockPrepareForegroundAudio = jest.fn();

jest.mock("@/lib/rose-sound", () => ({
  roseToSoundParams: (...args: unknown[]) => mockRoseToSoundParams(...args),
  playWithParams: jest.fn(),
}));

jest.mock("@/lib/sound", () => ({
  prepareForegroundAudio: () => mockPrepareForegroundAudio(),
}));

const params = {
  fx: 1.2,
  fy: 0.8,
  waveform: "sine" as OscillatorType,
  baseFreq: 440,
  phase: Math.PI / 2,
  stroke: "#ff6688",
  glow: "rgba(255, 102, 136, 0.6)",
};

const rose: Rose = {
  id: "rose-1",
  color: "red",
  gratitude: "thanks",
  anxiety: null,
  hope: "tomorrow",
  user_id: "user-1",
  nickname: "tester",
  like_count: 2,
  ai_reply: null,
  is_private: false,
  created_at: "2026-01-01T00:00:00Z",
  recipient_nickname: null,
  is_gift: false,
};

const canvasContext = {
  fillStyle: "",
  lineWidth: 0,
  shadowBlur: 0,
  shadowColor: "",
  lineCap: "",
  strokeStyle: "",
  fillRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
};

function createAudioContextMock() {
  const merger = { connect: jest.fn() };
  const delay = { delayTime: { value: 0 }, connect: jest.fn() };
  const gains = [
    { gain: { value: 0 }, connect: jest.fn() },
    { gain: { value: 0 }, connect: jest.fn() },
  ];
  const analysers = [
    {
      fftSize: 0,
      frequencyBinCount: 3,
      getFloatTimeDomainData: jest.fn((buffer: Float32Array) => {
        buffer[0] = -0.5;
        buffer[1] = 0;
        buffer[2] = 0.5;
      }),
    },
    {
      fftSize: 0,
      frequencyBinCount: 3,
      getFloatTimeDomainData: jest.fn((buffer: Float32Array) => {
        buffer[0] = 0.5;
        buffer[1] = 0;
        buffer[2] = -0.5;
      }),
    },
  ];
  const oscillators = [
    {
      type: "sine" as OscillatorType,
      frequency: { value: 0 },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    },
    {
      type: "sine" as OscillatorType,
      frequency: { value: 0 },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    },
  ];
  const ctx = {
    destination: {},
    createChannelMerger: jest.fn().mockReturnValue(merger),
    createAnalyser: jest.fn(() => analysers.shift()),
    createOscillator: jest.fn(() => oscillators.shift()),
    createGain: jest.fn(() => gains.shift()),
    createDelay: jest.fn().mockReturnValue(delay),
    close: jest.fn(),
  };
  return { ctx, merger, delay };
}

describe("RosePlayer", () => {
  const audioContexts: ReturnType<typeof createAudioContextMock>[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    audioContexts.length = 0;
    mockRoseToSoundParams.mockResolvedValue(params);
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: jest.fn(() => canvasContext),
    });
    (global as unknown as { requestAnimationFrame: jest.Mock }).requestAnimationFrame = jest.fn(() => 7);
    (global as unknown as { cancelAnimationFrame: jest.Mock }).cancelAnimationFrame = jest.fn();
    (global as unknown as { AudioContext: jest.Mock }).AudioContext = jest.fn(() => {
      const audio = createAudioContextMock();
      audioContexts.push(audio);
      return audio.ctx;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads params, starts drawing, and stops on click", async () => {
    const onStop = jest.fn();
    render(<RosePlayer rose={rose} onStop={onStop} />);

    const playButton = await screen.findByRole("button", { name: "▶ 听这朵玫瑰" });
    await waitFor(() => expect(playButton).not.toBeDisabled());

    fireEvent.click(playButton);

    await waitFor(() => expect(screen.getByRole("button", { name: "■ 停止" })).toBeInTheDocument());
    expect(mockRoseToSoundParams).toHaveBeenCalledWith(rose);
    expect(mockPrepareForegroundAudio).toHaveBeenCalledTimes(1);
    expect(audioContexts[0].ctx.createChannelMerger).toHaveBeenCalledWith(2);
    expect(audioContexts[0].ctx.createAnalyser).toHaveBeenCalledTimes(2);
    expect(canvasContext.fillRect).toHaveBeenCalled();
    expect(canvasContext.lineTo).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "■ 停止" }));

    expect(audioContexts[0].ctx.close).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("auto-plays and stops after duration", async () => {
    jest.useFakeTimers();
    const onStop = jest.fn();

    render(<RosePlayer rose={rose} autoPlay durationMs={100} onStop={onStop} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "■ 停止" })).toBeInTheDocument());

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(audioContexts[0].ctx.close).toHaveBeenCalledTimes(1);
  });
});

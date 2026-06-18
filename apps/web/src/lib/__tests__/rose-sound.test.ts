import { roseToSoundParamsWasm } from "@/lib/recommend";
import { playWithParams, roseToSoundParams, type RoseSoundParams } from "../rose-sound";
import type { Rose } from "../api";

jest.mock("@/lib/recommend", () => ({
  roseToSoundParamsWasm: jest.fn(),
}));

const mockRose: Rose = {
  id: "rose-1",
  color: "red",
  gratitude: "thanks",
  anxiety: null,
  hope: "tomorrow",
  user_id: "user-1",
  nickname: "tester",
  like_count: 3,
  ai_reply: null,
  is_private: false,
  created_at: "2026-01-01T00:00:00Z",
  recipient_nickname: null,
  is_gift: false,
};

function createAudioContextMock() {
  const merger = { connect: jest.fn() };
  const delay = { delayTime: { value: 0 }, connect: jest.fn() };
  const gains = [
    { gain: { value: 0 }, connect: jest.fn() },
    { gain: { value: 0 }, connect: jest.fn() },
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
    createOscillator: jest.fn(() => oscillators.shift()),
    createGain: jest.fn(() => gains.shift()),
    createDelay: jest.fn().mockReturnValue(delay),
    close: jest.fn(),
  };
  return { ctx, merger, delay, gains, oscillators };
}

describe("rose-sound", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("maps WASM snake_case audio params to camelCase", async () => {
    (roseToSoundParamsWasm as jest.Mock).mockResolvedValue({
      fx: 1.2,
      fy: 0.8,
      waveform: "triangle",
      base_freq: 330,
      phase: 1.5,
      stroke: "#fff",
      glow: "rgba(255,255,255,0.5)",
    });

    await expect(roseToSoundParams(mockRose)).resolves.toEqual({
      fx: 1.2,
      fy: 0.8,
      waveform: "triangle",
      baseFreq: 330,
      phase: 1.5,
      stroke: "#fff",
      glow: "rgba(255,255,255,0.5)",
    });
    expect(roseToSoundParamsWasm).toHaveBeenCalledWith(JSON.stringify({
      color: "red",
      gratitude: "thanks",
      anxiety: null,
      hope: "tomorrow",
      like_count: 3,
    }));
  });

  it("throws when WASM audio params are unavailable", async () => {
    (roseToSoundParamsWasm as jest.Mock).mockResolvedValue(null);
    await expect(roseToSoundParams(mockRose)).rejects.toThrow("WASM unavailable");
  });

  it("plays stereo oscillators and stops idempotently", () => {
    const audio = createAudioContextMock();
    (global as unknown as { AudioContext: jest.Mock }).AudioContext = jest.fn(() => audio.ctx);

    const params: RoseSoundParams = {
      fx: 1.5,
      fy: 0.5,
      waveform: "sawtooth",
      baseFreq: 440,
      phase: Math.PI,
      stroke: "#f00",
      glow: "#f99",
    };

    const player = playWithParams(params, 0.4, 50);

    expect(audio.ctx.createChannelMerger).toHaveBeenCalledWith(2);
    expect(audio.ctx.createDelay).toHaveBeenCalledWith(1);
    expect(audio.delay.delayTime.value).toBeCloseTo(Math.PI / (2 * Math.PI * 220));
    expect(audio.merger.connect).toHaveBeenCalledWith(audio.ctx.destination);

    jest.advanceTimersByTime(50);
    expect(audio.ctx.close).toHaveBeenCalledTimes(1);
    player.stop();
    expect(audio.ctx.close).toHaveBeenCalledTimes(1);
  });

  it("uses zero delay when right-channel frequency is zero", () => {
    const audio = createAudioContextMock();
    (global as unknown as { AudioContext: jest.Mock }).AudioContext = jest.fn(() => audio.ctx);

    playWithParams({
      fx: 1,
      fy: 0,
      waveform: "sine",
      baseFreq: 440,
      phase: Math.PI,
      stroke: "#f00",
      glow: "#f99",
    }).stop();

    expect(audio.delay.delayTime.value).toBe(0);
    expect(audio.ctx.close).toHaveBeenCalledTimes(1);
  });
});

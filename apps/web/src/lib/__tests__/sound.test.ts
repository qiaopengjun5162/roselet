// Mock Tone.js
const mockDispose = jest.fn();
const mockTriggerAttackRelease = jest.fn();
const mockStart = jest.fn();

const createMockSynth = () => ({
  triggerAttackRelease: mockTriggerAttackRelease,
  dispose: mockDispose,
  volume: { value: 0 },
  toDestination: jest.fn().mockReturnThis(),
});

const createMockPolySynth = () => ({
  triggerAttackRelease: mockTriggerAttackRelease,
  dispose: mockDispose,
  volume: { value: 0 },
  toDestination: jest.fn().mockReturnThis(),
});

jest.mock("tone", () => {
  const mockTransport = { start: jest.fn(), stop: jest.fn() };
  return {
    start: jest.fn().mockResolvedValue(undefined),
    now: jest.fn().mockReturnValue(0),
    Synth: jest.fn().mockImplementation(() => createMockSynth()),
    PolySynth: jest.fn().mockImplementation(() => createMockPolySynth()),
    MembraneSynth: jest.fn().mockImplementation(() => createMockSynth()),
    Loop: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      dispose: jest.fn(),
    })),
    Transport: { start: jest.fn(), stop: jest.fn() },
    getTransport: jest.fn().mockReturnValue(mockTransport),
    getDestination: jest.fn().mockReturnValue({ mute: false }),
  };
});

import { isMuted, toggleMute, playClick, playPlant, playComplete, playLike, playNotify } from "../sound";

describe("sound", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should start muted by default", () => {
    expect(isMuted()).toBe(true);
  });

  it("should toggle mute state", () => {
    const result = toggleMute();
    expect(result).toBe(false);
    expect(isMuted()).toBe(false);

    const result2 = toggleMute();
    expect(result2).toBe(true);
    expect(isMuted()).toBe(true);
  });

  it("playClick should not play when muted", async () => {
    await playClick();
    expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
  });

  it("playPlant should not play when muted", async () => {
    await playPlant();
    expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
  });

  it("playComplete should not play when muted", async () => {
    await playComplete();
    expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
  });

  it("playLike should not play when muted", async () => {
    await playLike();
    expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
  });

  it("playNotify should not play when muted", async () => {
    await playNotify();
    expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
  });
});

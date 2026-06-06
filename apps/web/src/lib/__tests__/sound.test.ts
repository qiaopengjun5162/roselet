// Mock Tone.js
const mockDispose = jest.fn();
const mockTriggerAttackRelease = jest.fn();
const mockTransportStart = jest.fn();
const mockTransportStop = jest.fn();
const mockLoopStart = jest.fn();
const mockLoopStop = jest.fn();
const mockLoopDispose = jest.fn();
const mockDestination = { mute: false };

const createMockSynth = () => ({
  triggerAttackRelease: mockTriggerAttackRelease,
  dispose: mockDispose,
  volume: { value: 0 },
  toDestination: jest.fn().mockReturnThis(),
});

jest.mock("tone", () => ({
  start: jest.fn().mockResolvedValue(undefined),
  now: jest.fn().mockReturnValue(0),
  Synth: jest.fn().mockImplementation(() => createMockSynth()),
  PolySynth: jest.fn().mockImplementation(() => createMockSynth()),
  MembraneSynth: jest.fn().mockImplementation(() => createMockSynth()),
  Loop: jest.fn().mockImplementation(() => ({
    start: mockLoopStart,
    stop: mockLoopStop,
    dispose: mockLoopDispose,
  })),
  getDestination: jest.fn().mockReturnValue(mockDestination),
  getTransport: jest.fn().mockReturnValue({
    start: mockTransportStart,
    stop: mockTransportStop,
  }),
}));

describe("sound", () => {
  let sound: typeof import("@/lib/sound");

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    jest.clearAllMocks();
    mockDestination.mute = false;
    sound = require("@/lib/sound");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should start unmuted by default", () => {
    expect(sound.isMuted()).toBe(false);
  });

  it("should toggle mute on", () => {
    expect(sound.isMuted()).toBe(false);
    const result = sound.toggleMute();
    expect(result).toBe(true);
    expect(sound.isMuted()).toBe(true);
    expect(mockDestination.mute).toBe(true);
  });

  it("should toggle mute off", () => {
    sound.toggleMute();
    const result = sound.toggleMute();
    expect(result).toBe(false);
    expect(sound.isMuted()).toBe(false);
    expect(mockDestination.mute).toBe(false);
  });

  it("plays click sound and disposes it", async () => {
    await expect(sound.playClick()).resolves.toBeUndefined();
    expect(mockTriggerAttackRelease).toHaveBeenCalledWith("C5", "16n");
    jest.advanceTimersByTime(500);
    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it("plays plant chord", async () => {
    await sound.playPlant();
    expect(mockTriggerAttackRelease).toHaveBeenCalledWith(["C4", "E4", "G4"], "4n");
    jest.advanceTimersByTime(1000);
    expect(mockDispose).toHaveBeenCalled();
  });

  it("plays completion arpeggio", async () => {
    await sound.playComplete();
    expect(mockTriggerAttackRelease).toHaveBeenCalledWith("C5", "8n", 0);
    const lastCall = mockTriggerAttackRelease.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe("C6");
    expect(lastCall?.[1]).toBe("8n");
    expect(lastCall?.[2]).toBeCloseTo(0.45);
    jest.advanceTimersByTime(1500);
    expect(mockDispose).toHaveBeenCalled();
  });

  it("plays like bounce including delayed note", async () => {
    await sound.playLike();
    expect(mockTriggerAttackRelease).toHaveBeenCalledWith("C3", "16n");
    jest.advanceTimersByTime(120);
    expect(mockTriggerAttackRelease).toHaveBeenCalledWith("E3", "16n");
    jest.advanceTimersByTime(480);
    expect(mockDispose).toHaveBeenCalled();
  });

  it("plays notification interval", async () => {
    await sound.playNotify();
    expect(mockTriggerAttackRelease).toHaveBeenCalledWith("E5", "8n", 0);
    expect(mockTriggerAttackRelease).toHaveBeenCalledWith("B5", "8n", 0.12);
    jest.advanceTimersByTime(800);
    expect(mockDispose).toHaveBeenCalled();
  });

  it("should not throw when playing while muted", async () => {
    sound.toggleMute();
    expect(sound.isMuted()).toBe(true);
    await expect(sound.playClick()).resolves.toBeUndefined();
    expect(mockTriggerAttackRelease).not.toHaveBeenCalled();
  });

  it("starts and stops background music", async () => {
    const Tone = require("tone");

    await sound.startBgMusic();
    expect(sound.isBgPlaying()).toBe(true);
    expect(mockTransportStart).toHaveBeenCalledTimes(1);
    expect(mockLoopStart).toHaveBeenCalledWith(0);

    const loopCallback = Tone.Loop.mock.calls[0][0] as (time: number) => void;
    loopCallback(12);
    expect(mockTriggerAttackRelease).toHaveBeenCalledWith("C4", "2n", 12);

    await sound.startBgMusic();
    expect(Tone.Loop).toHaveBeenCalledTimes(1);

    sound.stopBgMusic();
    expect(sound.isBgPlaying()).toBe(false);
    expect(mockLoopStop).toHaveBeenCalledTimes(1);
    expect(mockLoopDispose).toHaveBeenCalledTimes(1);
    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect(mockTransportStop).toHaveBeenCalledTimes(1);
  });

  it("does not start background music while muted", async () => {
    const Tone = require("tone");

    sound.toggleMute();
    await sound.startBgMusic();
    expect(sound.isBgPlaying()).toBe(false);
    expect(Tone.Loop).not.toHaveBeenCalled();
  });
});

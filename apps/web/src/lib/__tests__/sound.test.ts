// Mock Tone.js
const mockDispose = jest.fn();
const mockTriggerAttackRelease = jest.fn();

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
  Loop: jest.fn().mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), dispose: jest.fn() })),
  getDestination: jest.fn().mockReturnValue({ mute: false }),
  getTransport: jest.fn().mockReturnValue({ start: jest.fn(), stop: jest.fn() }),
}));

describe("sound", () => {
  let isMuted: () => boolean;
  let toggleMute: () => boolean;
  let playClick: () => Promise<void>;

  beforeEach(() => {
    jest.resetModules();
    const sound = require("@/lib/sound");
    isMuted = sound.isMuted;
    toggleMute = sound.toggleMute;
    playClick = sound.playClick;
  });

  it("should start unmuted by default", () => {
    expect(isMuted()).toBe(false);
  });

  it("should toggle mute on", () => {
    expect(isMuted()).toBe(false);
    const result = toggleMute();
    expect(result).toBe(true);
    expect(isMuted()).toBe(true);
  });

  it("should toggle mute off", () => {
    toggleMute(); // → muted
    const result = toggleMute(); // → unmuted
    expect(result).toBe(false);
    expect(isMuted()).toBe(false);
  });

  it("should not throw when playing while unmuted", async () => {
    expect(isMuted()).toBe(false);
    await expect(playClick()).resolves.toBeUndefined();
  });

  it("should not throw when playing while muted", async () => {
    toggleMute();
    expect(isMuted()).toBe(true);
    await expect(playClick()).resolves.toBeUndefined();
  });
});
